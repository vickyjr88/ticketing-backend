import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ticket, TicketType, TicketStatus } from '../../entities/ticket.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Order, PaymentProvider } from '../../entities/order.entity';
import { EventsService } from '../events/events.service';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

interface PurchaseItem {
  tierId: string;
  quantity: number;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketTier)
    private tierRepository: Repository<TicketTier>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private eventsService: EventsService,
    private dataSource: DataSource,
  ) {}

  /**
   * Main purchase logic with time validations and atomic inventory management
   */
  async purchaseTickets(
    userId: string,
    eventId: string,
    items: PurchaseItem[],
    paymentProvider: PaymentProvider,
  ): Promise<{ order: Order; tickets: Ticket[] }> {
    return await this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;
      const ticketsToCreate: Partial<Ticket>[] = [];

      // Validate and process each item
      for (const item of items) {
        // Lock the tier row to prevent race conditions (SELECT FOR UPDATE)
        const tier = await manager
          .createQueryBuilder(TicketTier, 'tier')
          .setLock('pessimistic_write')
          .where('tier.id = :id', { id: item.tierId })
          .getOne();

        if (!tier) {
          throw new NotFoundException(`Ticket tier ${item.tierId} not found`);
        }

        // TIME VALIDATION: Check if sales are active
        const now = new Date();
        if (tier.sales_start && now < new Date(tier.sales_start)) {
          throw new BadRequestException(
            `Sales for "${tier.name}" have not started yet. Sales start at ${tier.sales_start}`,
          );
        }

        if (tier.sales_end && now > new Date(tier.sales_end)) {
          throw new BadRequestException(
            `Sales for "${tier.name}" have ended. Sales ended at ${tier.sales_end}`,
          );
        }

        // Check if tier is active
        if (!tier.is_active) {
          throw new BadRequestException(`Ticket tier "${tier.name}" is not available`);
        }

        // Check max quantity per order
        if (item.quantity > tier.max_qty_per_order) {
          throw new BadRequestException(
            `Maximum ${tier.max_qty_per_order} units allowed per order for "${tier.name}"`,
          );
        }

        // Check inventory
        if (tier.remaining_quantity < item.quantity) {
          throw new BadRequestException(
            `Only ${tier.remaining_quantity} units remaining for "${tier.name}"`,
          );
        }

        // Decrement inventory atomically
        await manager.decrement(
          TicketTier,
          { id: tier.id },
          'remaining_quantity',
          item.quantity,
        );

        // Calculate total
        totalAmount += tier.price * item.quantity;

        // Generate tickets (tickets_per_unit logic)
        const totalTickets = item.quantity * tier.tickets_per_unit;
        for (let i = 0; i < totalTickets; i++) {
          ticketsToCreate.push({
            event_id: eventId,
            tier_id: tier.id,
            purchaser_id: userId,
            holder_id: userId,
            type: TicketType.STANDARD,
            status: TicketStatus.ISSUED,
            qr_code_hash: uuidv4(),
          });
        }
      }

      // Create order
      const order = manager.create(Order, {
        user_id: userId,
        total_amount: totalAmount,
        payment_provider: paymentProvider,
      });
      const savedOrder = await manager.save(Order, order);

      // Create tickets
      const tickets = ticketsToCreate.map((ticketData) =>
        manager.create(Ticket, {
          ...ticketData,
          order_id: savedOrder.id,
        }),
      );
      const savedTickets = await manager.save(Ticket, tickets);

      return { order: savedOrder, tickets: savedTickets };
    });
  }

  /**
   * Adopt-a-Ticket flow: Purchase tickets for the gift pool
   */
  async adoptTickets(
    userId: string,
    eventId: string,
    tierId: string,
    quantity: number,
    paymentProvider: PaymentProvider,
  ): Promise<{ order: Order; tickets: Ticket[] }> {
    // Verify event has lottery enabled
    const event = await this.eventsService.findById(eventId);
    if (!event.lottery_enabled) {
      throw new BadRequestException('This event does not have lottery enabled');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Lock tier
      const tier = await manager
        .createQueryBuilder(TicketTier, 'tier')
        .setLock('pessimistic_write')
        .where('tier.id = :id', { id: tierId })
        .getOne();

      if (!tier) {
        throw new NotFoundException('Ticket tier not found');
      }

      // Time validation
      const now = new Date();
      if (tier.sales_start && now < new Date(tier.sales_start)) {
        throw new BadRequestException('Sales not active');
      }
      if (tier.sales_end && now > new Date(tier.sales_end)) {
        throw new BadRequestException('Sales ended');
      }

      // Check inventory
      if (tier.remaining_quantity < quantity) {
        throw new BadRequestException('Not enough tickets available');
      }

      // Decrement inventory
      await manager.decrement(TicketTier, { id: tier.id }, 'remaining_quantity', quantity);

      const totalAmount = tier.price * quantity;

      // Create order
      const order = manager.create(Order, {
        user_id: userId,
        total_amount: totalAmount,
        payment_provider: paymentProvider,
      });
      const savedOrder = await manager.save(Order, order);

      // Create tickets for pool (ADOPTED type, POOL status)
      const totalTickets = quantity * tier.tickets_per_unit;
      const tickets: Partial<Ticket>[] = [];
      for (let i = 0; i < totalTickets; i++) {
        tickets.push({
          event_id: eventId,
          tier_id: tier.id,
          purchaser_id: userId,
          holder_id: null, // No holder yet
          type: TicketType.ADOPTED,
          status: TicketStatus.POOL,
          qr_code_hash: uuidv4(),
          order_id: savedOrder.id,
        });
      }

      const savedTickets = await manager.save(
        Ticket,
        tickets.map((t) => manager.create(Ticket, t)),
      );

      return { order: savedOrder, tickets: savedTickets };
    });
  }

  /**
   * Generate QR code for a ticket
   */
  async generateQRCode(ticketId: string): Promise<string> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Generate QR code as data URL
    const qrData = JSON.stringify({
      ticketId: ticket.id,
      eventId: ticket.event_id,
      qrHash: ticket.qr_code_hash,
    });

    return await QRCode.toDataURL(qrData);
  }

  /**
   * Check-in a ticket at the event
   */
  async checkIn(qrHash: string, scannerId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { qr_code_hash: qrHash },
      relations: ['event', 'tier', 'holder'],
    });

    if (!ticket) {
      throw new NotFoundException('Invalid ticket');
    }

    if (ticket.status === TicketStatus.REDEEMED) {
      throw new BadRequestException('Ticket already redeemed');
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Ticket is cancelled');
    }

    // Update ticket status
    ticket.status = TicketStatus.REDEEMED;
    ticket.checked_in_at = new Date();
    ticket.checked_in_by = scannerId;

    return this.ticketsRepository.save(ticket);
  }

  /**
   * Get user tickets
   */
  async getUserTickets(userId: string): Promise<Ticket[]> {
    return this.ticketsRepository.find({
      where: { holder_id: userId },
      relations: ['event', 'tier'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: ['event', 'tier', 'purchaser', 'holder'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }
}
