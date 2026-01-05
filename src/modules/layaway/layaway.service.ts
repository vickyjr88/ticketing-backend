import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, PaymentStatus, PaymentProvider, PaymentType } from '../../entities/order.entity';
import { PartialPayment, PartialPaymentStatus } from '../../entities/partial-payment.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Ticket, TicketType, TicketStatus } from '../../entities/ticket.entity';
import { Product } from '../../entities/product.entity';
import { OrderProduct } from '../../entities/order-product.entity';
import { EventsService } from '../events/events.service';
import { PromoService } from '../promo/promo.service';
import { MpesaService } from '../payments/services/mpesa.service';
import { PaystackService } from '../payments/services/paystack.service';
import { CreateLayawayOrderDto, TopUpPaymentDto } from './dto/layaway.dto';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LayawayService {
    private readonly logger = new Logger(LayawayService.name);

    constructor(
        @InjectRepository(Order)
        private ordersRepository: Repository<Order>,
        @InjectRepository(PartialPayment)
        private partialPaymentsRepository: Repository<PartialPayment>,
        @InjectRepository(TicketTier)
        private tierRepository: Repository<TicketTier>,
        @InjectRepository(Ticket)
        private ticketsRepository: Repository<Ticket>,
        @InjectRepository(Product)
        private productsRepository: Repository<Product>,
        @InjectRepository(OrderProduct)
        private orderProductsRepository: Repository<OrderProduct>,
        private eventsService: EventsService,
        private promoService: PromoService,
        private mpesaService: MpesaService,
        private paystackService: PaystackService,
        private dataSource: DataSource,
    ) { }

    /**
     * Create a new Lipa Pole Pole order with initial payment
     */
    async createLayawayOrder(
        userId: string,
        dto: CreateLayawayOrderDto,
    ): Promise<{ order: Order; paymentInitiated: boolean; paymentData?: any }> {
        return await this.dataSource.transaction(async (manager) => {
            const event = await this.eventsService.findById(dto.eventId);
            if (!event) {
                throw new NotFoundException('Event not found');
            }

            // Check if event allows Lipa Pole Pole
            if (!event.allows_layaway) {
                throw new BadRequestException('Lipa Pole Pole is not enabled for this event. Please use regular checkout.');
            }

            let totalAmount = 0;
            const ticketsToCreate: Partial<Ticket>[] = [];

            // Process ticket tiers
            for (const item of dto.items) {
                const tier = await manager
                    .createQueryBuilder(TicketTier, 'tier')
                    .setLock('pessimistic_write')
                    .where('tier.id = :id', { id: item.tierId })
                    .getOne();

                if (!tier) {
                    throw new NotFoundException(`Ticket tier ${item.tierId} not found`);
                }

                if (tier.event_id !== dto.eventId) {
                    throw new BadRequestException('Tier does not belong to this event');
                }

                // Check inventory
                if (tier.remaining_quantity < item.quantity) {
                    throw new BadRequestException(`Only ${tier.remaining_quantity} tickets available for ${tier.name}`);
                }

                // Decrement inventory (reserve tickets)
                await manager.decrement(TicketTier, { id: tier.id }, 'remaining_quantity', item.quantity);

                totalAmount += Number(tier.price) * item.quantity;

                // Create PENDING tickets (will be issued when fully paid)
                const totalTickets = item.quantity * tier.tickets_per_unit;
                for (let i = 0; i < totalTickets; i++) {
                    ticketsToCreate.push({
                        event_id: dto.eventId,
                        tier_id: tier.id,
                        purchaser_id: userId,
                        holder_id: userId,
                        type: TicketType.STANDARD,
                        status: TicketStatus.PENDING,
                        qr_code_hash: uuidv4(),
                    });
                }
            }

            let subtotal = totalAmount;
            let discountAmount = 0;
            let promoCodeId: string | null = null;

            // Process promo code if provided
            if (dto.promoCode) {
                const promoResult = await this.promoService.validatePromoCode(
                    dto.promoCode,
                    userId,
                    dto.eventId,
                    totalAmount,
                    dto.products?.map(p => p.productId) || [],
                );
                if (promoResult.valid) {
                    discountAmount = promoResult.discount_amount || 0;
                    totalAmount -= discountAmount;
                    promoCodeId = promoResult.promo_code?.id || null;
                }
            }

            // Validate initial payment is less than total
            if (dto.initialAmount >= totalAmount) {
                throw new BadRequestException(
                    `Initial payment (${dto.initialAmount}) must be less than total amount (${totalAmount}). Use regular checkout for full payment.`
                );
            }

            // Minimum payment validation (at least 10% or Ksh 100)
            const minPayment = Math.max(100, totalAmount * 0.1);
            if (dto.initialAmount < minPayment) {
                throw new BadRequestException(`Minimum initial payment is KES ${Math.ceil(minPayment)}`);
            }

            // Create order
            const order = manager.create(Order, {
                user_id: userId,
                event_id: dto.eventId,
                total_amount: totalAmount,
                subtotal,
                discount_amount: discountAmount,
                promo_code_id: promoCodeId,
                payment_status: PaymentStatus.PENDING,
                payment_provider: dto.paymentProvider as PaymentProvider,
                payment_type: PaymentType.LIPA_POLE_POLE,
                amount_paid: 0,
                layaway_deadline: dto.layawayDeadline ? new Date(dto.layawayDeadline) : null,
            });
            const savedOrder = await manager.save(Order, order);

            // Create tickets with order reference
            const tickets = ticketsToCreate.map(t =>
                manager.create(Ticket, { ...t, order_id: savedOrder.id })
            );
            await manager.save(Ticket, tickets);

            // Process products if any
            if (dto.products && dto.products.length > 0) {
                for (const prodItem of dto.products) {
                    const product = await this.productsRepository.findOne({ where: { id: prodItem.productId } });
                    if (product) {
                        const orderProduct = manager.create(OrderProduct, {
                            order_id: savedOrder.id,
                            product_id: prodItem.productId,
                            quantity: prodItem.quantity,
                            price: product.price,
                        });
                        await manager.save(OrderProduct, orderProduct);
                    }
                }
            }

            // Initiate initial payment
            const paymentResult = await this.initiatePartialPayment(
                savedOrder,
                dto.initialAmount,
                dto.paymentProvider,
                dto.phoneNumber,
            );

            return {
                order: savedOrder,
                paymentInitiated: true,
                paymentData: paymentResult,
            };
        });
    }

    /**
     * Make a top-up payment on an existing layaway order
     */
    async topUpPayment(
        userId: string,
        orderId: string,
        dto: TopUpPaymentDto,
    ): Promise<{ partialPayment: PartialPayment; paymentData?: any }> {
        const order = await this.ordersRepository.findOne({
            where: { id: orderId, user_id: userId },
            relations: ['event'],
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.payment_type !== PaymentType.LIPA_POLE_POLE) {
            throw new BadRequestException('This is not a Lipa Pole Pole order');
        }

        if (order.payment_status === PaymentStatus.PAID) {
            throw new BadRequestException('Order is already fully paid');
        }

        const balance = Number(order.total_amount) - Number(order.amount_paid);

        // Prevent overpayment
        if (dto.amount > balance) {
            throw new BadRequestException(
                `Payment amount (${dto.amount}) exceeds balance due (${balance}). Maximum allowed: KES ${balance}`
            );
        }

        // Minimum payment validation
        const minPayment = Math.min(100, balance);
        if (dto.amount < minPayment) {
            throw new BadRequestException(`Minimum payment is KES ${minPayment}`);
        }

        // Initiate payment
        const paymentResult = await this.initiatePartialPayment(
            order,
            dto.amount,
            dto.paymentProvider,
            dto.phoneNumber,
            dto.successUrl,
            dto.cancelUrl,
        );

        return paymentResult;
    }

    /**
     * Initiate a partial payment
     */
    private async initiatePartialPayment(
        order: Order,
        amount: number,
        provider: string,
        phoneNumber?: string,
        successUrl?: string,
        cancelUrl?: string,
    ): Promise<{ partialPayment: PartialPayment; paymentData?: any }> {
        // Create partial payment record
        const partialPayment = this.partialPaymentsRepository.create({
            order_id: order.id,
            amount,
            payment_provider: provider,
            phone_number: phoneNumber,
            status: PartialPaymentStatus.PENDING,
        });
        const savedPayment = await this.partialPaymentsRepository.save(partialPayment);

        let paymentData: any = null;

        // Initiate payment based on provider
        if (provider === 'MPESA') {
            if (!phoneNumber) {
                throw new BadRequestException('Phone number is required for M-Pesa payments');
            }

            try {
                const mpesaResult = await this.mpesaService.stkPush(
                    phoneNumber,
                    amount,
                    order.id,
                );
                savedPayment.transaction_reference = mpesaResult.CheckoutRequestID;
                savedPayment.payment_metadata = mpesaResult;
                await this.partialPaymentsRepository.save(savedPayment);
                paymentData = mpesaResult;
            } catch (error) {
                this.logger.error('M-Pesa payment initiation failed:', error);
                savedPayment.status = PartialPaymentStatus.FAILED;
                await this.partialPaymentsRepository.save(savedPayment);
                throw new BadRequestException('Failed to initiate M-Pesa payment');
            }
        } else if (provider === 'PAYSTACK') {
            try {
                // Need user email for Paystack
                const paystackResult = await this.paystackService.initializeTransaction(
                    'customer@example.com', // TODO: Fetch user email from order
                    amount,
                    savedPayment.id,
                    successUrl || `${process.env.FRONTEND_URL}/layaway/callback`,
                );
                savedPayment.transaction_reference = paystackResult.data?.reference;
                savedPayment.payment_metadata = paystackResult;
                await this.partialPaymentsRepository.save(savedPayment);
                paymentData = paystackResult;
            } catch (error) {
                this.logger.error('Paystack payment initiation failed:', error);
                savedPayment.status = PartialPaymentStatus.FAILED;
                await this.partialPaymentsRepository.save(savedPayment);
                throw new BadRequestException('Failed to initiate Paystack payment');
            }
        }

        return { partialPayment: savedPayment, paymentData };
    }

    /**
     * Process successful partial payment
     */
    async processPartialPaymentSuccess(paymentId: string): Promise<Order> {
        const partialPayment = await this.partialPaymentsRepository.findOne({
            where: { id: paymentId },
            relations: ['order'],
        });

        if (!partialPayment) {
            throw new NotFoundException('Partial payment not found');
        }

        if (partialPayment.status === PartialPaymentStatus.COMPLETED) {
            return partialPayment.order;
        }

        // Update partial payment status
        partialPayment.status = PartialPaymentStatus.COMPLETED;
        partialPayment.completed_at = new Date();
        await this.partialPaymentsRepository.save(partialPayment);

        // Update order amount_paid
        const order = await this.ordersRepository.findOne({
            where: { id: partialPayment.order_id },
            relations: ['tickets'],
        });

        const newAmountPaid = Number(order.amount_paid) + Number(partialPayment.amount);
        order.amount_paid = newAmountPaid;

        // Check if fully paid
        if (newAmountPaid >= Number(order.total_amount)) {
            order.payment_status = PaymentStatus.PAID;
            order.paid_at = new Date();

            // Issue tickets
            await this.issueTickets(order.id);

            this.logger.log(`Order ${order.id} fully paid via Lipa Pole Pole. Tickets issued.`);
        } else {
            order.payment_status = PaymentStatus.PARTIAL;
        }

        return this.ordersRepository.save(order);
    }

    /**
     * Issue tickets for a fully paid order
     */
    private async issueTickets(orderId: string): Promise<void> {
        await this.ticketsRepository.update(
            { order_id: orderId, status: TicketStatus.PENDING },
            { status: TicketStatus.ISSUED }
        );
    }

    /**
     * Get user's layaway orders
     */
    async getUserLayawayOrders(
        userId: string,
        page: number = 1,
        limit: number = 20,
        status?: string,
    ): Promise<PaginatedResult<Order>> {
        const query = this.ordersRepository
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.event', 'event')
            .leftJoinAndSelect('order.tickets', 'tickets')
            .leftJoinAndSelect('tickets.tier', 'tier')
            .leftJoinAndSelect('order.partial_payments', 'partial_payments')
            .where('order.user_id = :userId', { userId })
            .andWhere('order.payment_type = :type', { type: PaymentType.LIPA_POLE_POLE })
            .orderBy('order.created_at', 'DESC');

        if (status) {
            query.andWhere('order.payment_status = :status', { status });
        }

        const total = await query.getCount();
        const data = await query.skip((page - 1) * limit).take(limit).getMany();

        return createPaginatedResult(data, total, page, limit);
    }

    /**
     * Get a single layaway order with payment history
     */
    async getLayawayOrder(userId: string, orderId: string): Promise<Order> {
        const order = await this.ordersRepository.findOne({
            where: { id: orderId, user_id: userId, payment_type: PaymentType.LIPA_POLE_POLE },
            relations: ['event', 'tickets', 'tickets.tier', 'partial_payments', 'order_products', 'order_products.product'],
        });

        if (!order) {
            throw new NotFoundException('Layaway order not found');
        }

        return order;
    }

    /**
     * Get payment history for an order
     */
    async getPaymentHistory(userId: string, orderId: string): Promise<PartialPayment[]> {
        const order = await this.ordersRepository.findOne({
            where: { id: orderId, user_id: userId },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return this.partialPaymentsRepository.find({
            where: { order_id: orderId },
            order: { created_at: 'DESC' },
        });
    }

    /**
     * Cancel a layaway order (only if not fully paid)
     */
    async cancelLayawayOrder(userId: string, orderId: string): Promise<{ refundAmount: number; message: string }> {
        const order = await this.ordersRepository.findOne({
            where: { id: orderId, user_id: userId },
            relations: ['tickets'],
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.payment_status === PaymentStatus.PAID) {
            throw new BadRequestException('Cannot cancel a fully paid order');
        }

        // Cancel tickets and restore inventory
        for (const ticket of order.tickets) {
            await this.ticketsRepository.update(ticket.id, { status: TicketStatus.CANCELLED });
            await this.tierRepository.increment({ id: ticket.tier_id }, 'remaining_quantity', 1);
        }

        // Mark order as failed/cancelled
        order.payment_status = PaymentStatus.FAILED;
        await this.ordersRepository.save(order);

        const refundAmount = Number(order.amount_paid);

        return {
            refundAmount,
            message: refundAmount > 0
                ? `Order cancelled. Refund of KES ${refundAmount} will be processed.`
                : 'Order cancelled successfully.',
        };
    }
}
