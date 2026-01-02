import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ticket, TicketType, TicketStatus } from '../../entities/ticket.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Order, PaymentProvider, PaymentStatus } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { EventsService } from '../events/events.service';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventsService: EventsService,
    private dataSource: DataSource,
  ) { }

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
      // Validate event exists first
      const event = await this.eventsService.findById(eventId);
      if (!event) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }

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

        // Validate tier belongs to event
        if (tier.event_id !== eventId) {
          throw new BadRequestException(
            `Tier "${tier.name}" does not belong to event "${event.title}"`
          );
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
            status: TicketStatus.PENDING, // Changed from ISSUED -> PENDING
            qr_code_hash: uuidv4(),
          });
        }
      }

      // Create order
      const order = manager.create(Order, {
        user_id: userId,
        event_id: eventId,
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
        event_id: eventId,
        total_amount: totalAmount,
        payment_provider: paymentProvider,
        payment_status: PaymentStatus.PENDING,
      });
      const savedOrder = await manager.save(Order, order);

      // Create tickets for pool (ADOPTED type, PENDING status)
      // Note: Adopted tickets are initially PENDING until paid, then become POOL
      const totalTickets = quantity * tier.tickets_per_unit;
      const tickets: Partial<Ticket>[] = [];
      for (let i = 0; i < totalTickets; i++) {
        tickets.push({
          event_id: eventId,
          tier_id: tier.id,
          purchaser_id: userId,
          holder_id: null,
          type: TicketType.ADOPTED,
          status: TicketStatus.PENDING, // Wait for payment before moving to POOL
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
   * Activate tickets for a paid order
   */
  async activateTicketsForOrder(orderId: string): Promise<void> {
    const tickets = await this.ticketsRepository.find({
      where: { order_id: orderId, status: TicketStatus.PENDING },
    });

    if (tickets.length === 0) return;

    for (const ticket of tickets) {
      if (ticket.type === TicketType.ADOPTED) {
        ticket.status = TicketStatus.POOL; // Move to lottery pool
      } else {
        ticket.status = TicketStatus.ISSUED; // Activate standard ticket
      }
    }

    await this.ticketsRepository.save(tickets);
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

    if (ticket.status === TicketStatus.PENDING) {
      throw new BadRequestException('Ticket not paid. Please complete payment.');
    }

    if (ticket.status === TicketStatus.REDEEMED) {
      throw new BadRequestException('Ticket already redeemed');
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Ticket is cancelled');
    }

    if (ticket.status === TicketStatus.POOL) {
      throw new BadRequestException('This ticket is in the lottery pool and hasn\'t been won yet.');
    }

    // Fetch scanner to get assigned gate
    const scanner = await this.userRepository.findOne({ where: { id: scannerId } });

    // Update ticket status
    ticket.status = TicketStatus.REDEEMED;
    ticket.checked_in_at = new Date();
    ticket.checked_in_by = scannerId;
    ticket.checked_in_gate = scanner?.assigned_gate || 'Unassigned';

    return this.ticketsRepository.save(ticket);
  }

  /**
   * Get ingress stats by gate
   */
  async getGateStats(eventId: string) {
    const stats = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .select('ticket.checked_in_gate', 'gate')
      .addSelect('COUNT(ticket.id)', 'count')
      .where('ticket.event_id = :eventId', { eventId })
      .andWhere('ticket.status = :status', { status: TicketStatus.REDEEMED })
      .andWhere('ticket.checked_in_gate IS NOT NULL')
      .groupBy('ticket.checked_in_gate')
      .getRawMany();

    return stats;
  }

  /**
   * Get user tickets with pagination
   */
  async issueComplimentaryTickets(
    issuerId: string,
    eventId: string,
    tierId: string,
    recipientEmail: string,
    quantity: number = 1,
  ): Promise<{ order: Order; tickets: Ticket[] }> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Validate Event
      const event = await this.eventsService.findById(eventId);
      if (!event) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }

      // 2. Validate Tier & Lock
      const tier = await manager
        .createQueryBuilder(TicketTier, 'tier')
        .setLock('pessimistic_write')
        .where('tier.id = :id', { id: tierId })
        .getOne();

      if (!tier) {
        throw new NotFoundException(`Ticket tier ${tierId} not found`);
      }
      if (tier.event_id !== eventId) {
        throw new BadRequestException(`Tier does not belong to event`);
      }
      if (tier.remaining_quantity < quantity) {
        throw new BadRequestException(`Not enough tickets available. Remaining: ${tier.remaining_quantity}`);
      }

      // 3. Find User
      const user = await manager.findOne(User, { where: { email: recipientEmail } });
      if (!user) {
        throw new NotFoundException(`User with email ${recipientEmail} not found. They must register first.`);
      }

      // 4. Create Order
      const order = manager.create(Order, {
        user_id: user.id,
        user: user,
        event_id: eventId,
        event: event,
        total_amount: 0,
        payment_status: PaymentStatus.PAID,
        payment_provider: PaymentProvider.COMPLIMENTARY,
        payment_metadata: {
          issuer_id: issuerId,
          type: 'COMPLIMENTARY',
        }
      });
      const savedOrder = await manager.save(Order, order);

      // 5. Create Tickets
      const tickets: Ticket[] = [];
      for (let i = 0; i < quantity; i++) {
        const uniqueHash = `TKT-${uuidv4().substring(0, 8).toUpperCase()}`;
        const ticket = manager.create(Ticket, {
          event_id: eventId,
          tier_id: tierId,
          order_id: savedOrder.id,
          purchaser_id: user.id,
          holder_id: user.id,
          type: TicketType.STANDARD,
          status: TicketStatus.ISSUED,
          qr_code_hash: uniqueHash,
        });
        tickets.push(ticket);
      }
      const savedTickets = await manager.save(Ticket, tickets);

      // 6. Update Inventory
      tier.remaining_quantity -= quantity;
      await manager.save(TicketTier, tier);

      return { order: savedOrder, tickets: savedTickets };
    });
  }

  async getUserTickets(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResult<Ticket>> {
    const [data, total] = await this.ticketsRepository.findAndCount({
      where: { holder_id: userId },
      relations: ['event', 'tier'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return createPaginatedResult(data, total, page, limit);
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

  /**
   * Transfer ticket to another user
   */
  async transferTicket(
    ticketId: string,
    senderId: string,
    recipientEmail: string,
  ): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: ['holder'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify ownership
    if (ticket.holder_id !== senderId) {
      throw new BadRequestException('You do not own this ticket');
    }

    // Verify status
    if (ticket.status !== TicketStatus.ISSUED && ticket.status !== TicketStatus.WON) {
      throw new BadRequestException('Ticket cannot be transferred (already used, pending or cancelled)');
    }

    // Find recipient (case-insensitive)
    const recipient = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: recipientEmail })
      .getOne();

    if (!recipient) {
      throw new NotFoundException(`Recipient with email ${recipientEmail} not found`);
    }

    // Prevent transfer to self
    if (recipient.id === senderId) {
      throw new BadRequestException('Cannot transfer ticket to yourself');
    }

    // Execute Transfer
    // 1. Invalidate old QR by generating new hash
    // 2. Change holder
    // IMPORTANT: Update both FK and relation object to ensure TypeORM saves it correctly
    ticket.holder = recipient;
    ticket.holder_id = recipient.id;
    ticket.qr_code_hash = uuidv4();

    // Ideally we would log this in a transfer_history table, but for now we just update
    return await this.ticketsRepository.save(ticket);
  }
}
