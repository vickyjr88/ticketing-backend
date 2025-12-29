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
import { PromoService } from '../promo/promo.service';
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
    private promoService: PromoService,
  ) { }

  /**
   * Standard/Group checkout with promo code support
   */
  async checkout(userId: string, checkoutDto: CheckoutDto) {
    const { eventId, items, paymentProvider, promoCode } = checkoutDto;

    // Create tickets and order
    const { order, tickets } = await this.ticketsService.purchaseTickets(
      userId,
      eventId,
      items,
      paymentProvider,
    );

    // Handle promo code if provided
    let discountAmount = 0;
    let promoCodeId: string | null = null;
    const subtotal = Number(order.total_amount);

    if (promoCode) {
      const promoResult = await this.promoService.validatePromoCode(
        promoCode,
        userId,
        eventId,
        subtotal,
      );

      if (!promoResult.valid) {
        // Promo code invalid - we've already created the order, so just don't apply discount
        // In a more strict implementation, you might want to validate before creating the order
        console.warn(`Promo code validation failed: ${promoResult.error}`);
      } else {
        discountAmount = promoResult.discount_amount;
        promoCodeId = promoResult.promo_code.id;

        // Apply promo code usage tracking
        await this.promoService.applyPromoCode(
          promoCodeId,
          userId,
          order.id,
          discountAmount,
        );
      }
    }

    // Update order with promo discount if applicable
    if (discountAmount > 0) {
      const finalAmount = subtotal - discountAmount;
      order.subtotal = subtotal;
      order.discount_amount = discountAmount;
      order.promo_code_id = promoCodeId;
      order.total_amount = finalAmount > 0 ? finalAmount : 0;
      await this.ordersRepository.save(order);
    }

    return {
      order,
      tickets,
      paymentRequired: true,
      discount_applied: discountAmount,
      message: promoCode && discountAmount > 0
        ? `Order created with KES ${discountAmount} discount. Proceed with payment.`
        : 'Order created. Proceed with payment.',
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
      relations: ['user', 'tickets', 'tickets.tier', 'tickets.event', 'event'],
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
      relations: ['user', 'tickets', 'tickets.tier', 'tickets.event', 'event'],
      order: { created_at: 'DESC', id: 'DESC' },
    });
  }
}

