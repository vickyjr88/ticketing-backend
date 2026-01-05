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
import { ProductsService } from '../products/products.service';
import { OrderProduct } from '../../entities/order-product.entity';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    private ticketsService: TicketsService,
    private promoService: PromoService,
    private productsService: ProductsService,
  ) { }

  /**
   * Standard/Group checkout with promo code support
   */
  async checkout(userId: string, checkoutDto: CheckoutDto) {
    const { eventId, items, products, paymentProvider, promoCode } = checkoutDto;

    // Create tickets and order
    const { order, tickets } = await this.ticketsService.purchaseTickets(
      userId,
      eventId,
      items,
      paymentProvider,
    );

    let productsTotal = 0;

    // Handle products
    if (products && products.length > 0) {
      if (!order.order_products) {
        order.order_products = [];
      }

      for (const item of products) {
        const product = await this.productsService.findOne(item.productId);

        // Check stock
        if (product.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for product ${product.name}`);
        }

        const op = new OrderProduct();
        op.product = product;
        op.quantity = item.quantity;
        op.unit_price = product.price;
        op.order = order;
        order.order_products.push(op);

        productsTotal += Number(product.price) * item.quantity;
      }
    }

    // Handle promo code if provided
    let discountAmount = 0;
    let promoCodeId: string | null = null;
    const subtotal = Number(order.total_amount) + productsTotal;

    if (promoCode) {
      const promoResult = await this.promoService.validatePromoCode(
        promoCode,
        userId,
        eventId,
        subtotal,
      );

      if (!promoResult.valid) {
        // Promo code invalid
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

    // Update order with products total and promo discount
    if (productsTotal > 0 || discountAmount > 0) {
      const finalAmount = subtotal - discountAmount;
      order.subtotal = subtotal;
      order.discount_amount = discountAmount;
      order.promo_code_id = promoCodeId;
      order.total_amount = finalAmount > 0 ? finalAmount : 0;
      await this.ordersRepository.save(order);
    }

    // Check for Free Order (totalAmount === 0)
    if (order.total_amount <= 0) {
      order.payment_status = PaymentStatus.PAID;
      order.paid_at = new Date();
      await this.ordersRepository.save(order);
      await this.ticketsService.activateTicketsForOrder(order.id);

      return {
        order,
        tickets,
        paymentRequired: false,
        discount_applied: discountAmount,
        message: 'Order completed successfully (Free).',
      };
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

    const savedOrder = await this.ordersRepository.save(order);

    // Activate tickets if payment successful
    if (status === PaymentStatus.PAID) {
      await this.ticketsService.activateTicketsForOrder(order.id);
    }

    return savedOrder;
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
   * Get user orders with pagination
   */
  async getUserOrders(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResult<Order>> {
    const [data, total] = await this.ordersRepository.findAndCount({
      where: { user_id: userId },
      relations: ['user', 'tickets', 'tickets.tier', 'tickets.event', 'event'],
      order: { created_at: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return createPaginatedResult(data, total, page, limit);
  }
}
