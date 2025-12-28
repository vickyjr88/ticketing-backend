import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatus, PaymentProvider } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { TicketsService } from '../tickets/tickets.service';
import { CheckoutDto } from './dto/checkout.dto';
import { AdoptTicketDto } from './dto/adopt-ticket.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    private ticketsService: TicketsService,
  ) {}

  /**
   * Standard/Group checkout
   */
  async checkout(userId: string, checkoutDto: CheckoutDto) {
    const { eventId, items, paymentProvider } = checkoutDto;

    // Create tickets and order
    const { order, tickets } = await this.ticketsService.purchaseTickets(
      userId,
      eventId,
      items,
      paymentProvider,
    );

    return {
      order,
      tickets,
      paymentRequired: true,
      message: 'Order created. Proceed with payment.',
    };
  }

  /**
   * Adopt-a-Ticket checkout
   */
  async adoptCheckout(userId: string, adoptDto: AdoptTicketDto) {
    const { eventId, tierId, quantity, paymentProvider } = adoptDto;

    // Create adopted tickets
    const { order, tickets } = await this.ticketsService.adoptTickets(
      userId,
      eventId,
      tierId,
      quantity,
      paymentProvider,
    );

    return {
      order,
      tickets,
      paymentRequired: true,
      message: 'Adoption order created. Proceed with payment.',
    };
  }

  /**
   * Update order payment status (called by payment webhooks)
   */
  async updatePaymentStatus(
    orderId: string,
    status: PaymentStatus,
    providerRef?: string,
    metadata?: any,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.payment_status = status;
    if (providerRef) {
      order.provider_ref = providerRef;
    }
    if (metadata) {
      order.payment_metadata = metadata;
    }
    if (status === PaymentStatus.PAID) {
      order.paid_at = new Date();
    }

    return this.ordersRepository.save(order);
  }

  /**
   * Get order by ID
   */
  async findById(orderId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'tickets', 'tickets.tier', 'tickets.event'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { user_id: userId },
      relations: ['tickets', 'tickets.tier', 'tickets.event'],
      order: { created_at: 'DESC' },
    });
  }
}
