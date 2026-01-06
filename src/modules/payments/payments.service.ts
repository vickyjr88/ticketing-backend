import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentProvider, PaymentStatus } from '../../entities/order.entity';
import { MpesaService } from './services/mpesa.service';
import { StripeService } from './services/stripe.service';
import { PaystackService } from './services/paystack.service';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';


@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private mpesaService: MpesaService,
    private stripeService: StripeService,
    private paystackService: PaystackService,
    private emailService: EmailService,
    private ordersService: OrdersService,
    private notificationsService: NotificationsService,
  ) { }

  /**
   * Initiate payment based on provider
   */
  async initiatePayment(
    orderId: string,
    phoneNumber?: string,
    successUrl?: string,
    cancelUrl?: string,
    paymentProvider?: string,
  ): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'event'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }

    // Update payment provider if requested
    if (paymentProvider && Object.values(PaymentProvider).includes(paymentProvider as PaymentProvider)) {
      order.payment_provider = paymentProvider as PaymentProvider;
      await this.ordersRepository.save(order);
    }

    // Log order details for debugging
    this.logger.log(`Initiating payment for order ${orderId}: provider=${order.payment_provider}, user_id=${order.user_id}, hasUser=${!!order.user}, email=${order.user?.email}`);

    switch (order.payment_provider) {
      case PaymentProvider.MPESA:
        if (!phoneNumber) {
          throw new BadRequestException('Phone number required for M-Pesa');
        }
        return this.mpesaService.stkPush(
          phoneNumber,
          Number(order.total_amount),
          orderId,
        );

      case PaymentProvider.STRIPE:
        if (!successUrl || !cancelUrl) {
          throw new BadRequestException('Success and cancel URLs required for Stripe');
        }
        return this.stripeService.createCheckoutSession(
          Number(order.total_amount),
          orderId,
          successUrl,
          cancelUrl,
        );

      case PaymentProvider.PAYSTACK:
        if (!successUrl) {
          throw new BadRequestException('Success URL (callback URL) is required for Paystack');
        }

        if (!order.user) {
          this.logger.error(`Order ${orderId} has no user relation loaded. user_id: ${order.user_id}`);
          throw new BadRequestException('Unable to load order user information. Please try again.');
        }

        if (!order.user.email) {
          this.logger.error(`User ${order.user.id} has no email address`);
          throw new BadRequestException(`User email is required for Paystack payment. Please update your profile with a valid email address.`);
        }

        this.logger.log(`Initializing Paystack payment for ${order.user.email}, amount: ${order.total_amount}`);

        return this.paystackService.initializeTransaction(
          order.user.email,
          Number(order.total_amount),
          orderId,
          successUrl
        );

      default:
        throw new BadRequestException('Unsupported payment provider');
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(orderId: string): Promise<{
    status: PaymentStatus;
    paid: boolean;
  }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    return {
      status: order.payment_status,
      paid: order.payment_status === PaymentStatus.PAID,
    };
  }

  // ... existing code ...

  /**
   * Handle M-Pesa callback (idempotent)
   */
  async handleMpesaCallback(callbackData: any): Promise<void> {
    const result = this.mpesaService.processCallback(callbackData);

    if (result.success) {
      // Find order by transaction reference
      const order = await this.ordersRepository.findOne({
        where: { provider_ref: result.orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for transaction ${result.transactionId}`);
        return;
      }

      // Idempotency check
      if (order.payment_status === PaymentStatus.PAID) {
        this.logger.warn(`Order ${order.id} already marked as paid`);
        return;
      }

      // Update order via service to trigger ticket activation
      await this.ordersService.updatePaymentStatus(
        order.id,
        PaymentStatus.PAID,
        result.transactionId,
        callbackData
      );
      this.logger.log(`Order ${order.id} marked as paid via M-Pesa`);

      // Send order confirmation email
      await this.sendOrderConfirmationEmail(order.id);
    }
  }

  /**
   * Handle Stripe webhook (idempotent)
   */
  async handleStripeWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const result = await this.stripeService.processWebhook(payload, signature);

    if (!result) {
      return; // Unhandled event type
    }

    const order = await this.ordersRepository.findOne({
      where: { id: result.orderId },
    });

    if (!order) {
      this.logger.warn(`Order ${result.orderId} not found for Stripe transaction`);
      return;
    }

    // Idempotency check
    if (order.payment_status === PaymentStatus.PAID && result.success) {
      this.logger.warn(`Order ${order.id} already marked as paid`);
      return;
    }

    // Update order via service to trigger ticket activation
    if (result.success) {
      await this.ordersService.updatePaymentStatus(
        order.id,
        PaymentStatus.PAID,
        result.transactionId
      );
    } else {
      await this.ordersService.updatePaymentStatus(
        order.id,
        PaymentStatus.FAILED
      );
    }

    this.logger.log(
      `Order ${order.id} payment status updated to ${result.success ? 'PAID' : 'FAILED'}`,
    );

    // Send order confirmation email on success
    if (result.success) {
      await this.sendOrderConfirmationEmail(order.id);
    }
  }

  // ... existing code ...

  /**
   * Verify Paystack transaction
   */
  async verifyPaystackTransaction(reference: string): Promise<any> {
    const result = await this.paystackService.verifyTransaction(reference);

    if (result.status && result.data.status === 'success') {
      const orderId = result.data.metadata.order_id;
      const order = await this.ordersRepository.findOne({ where: { id: orderId } });

      if (order) {
        if (order.payment_status !== PaymentStatus.PAID) {
          // Update order via service to trigger ticket activation
          await this.ordersService.updatePaymentStatus(
            order.id,
            PaymentStatus.PAID,
            result.data.reference,
            result.data
          );
          this.logger.log(`Order ${order.id} marked as paid via Paystack`);

          // Send order confirmation email
          await this.sendOrderConfirmationEmail(order.id);
        }
      }
      return { success: true, orderId };
    }
    return { success: false };
  }

  /**
   * Handle Paystack webhook (idempotent)
   */
  async handlePaystackWebhook(webhookData: any): Promise<void> {
    try {
      // Paystack sends event data in the 'data' field
      const event = webhookData.event;
      const data = webhookData.data;

      // Only process successful charge events
      if (event === 'charge.success' && data.status === 'success') {
        const orderId = data.metadata?.order_id;

        if (!orderId) {
          this.logger.warn('No order_id in Paystack webhook metadata');
          return;
        }

        const order = await this.ordersRepository.findOne({
          where: { id: orderId },
        });

        if (!order) {
          this.logger.warn(`Order ${orderId} not found for Paystack webhook`);
          return;
        }

        // Idempotency check
        if (order.payment_status === PaymentStatus.PAID) {
          this.logger.warn(`Order ${order.id} already marked as paid`);
          return;
        }

        // Update order via service to trigger ticket activation
        await this.ordersService.updatePaymentStatus(
          order.id,
          PaymentStatus.PAID,
          data.reference,
          data
        );


        this.logger.log(`Order ${order.id} marked as paid via Paystack webhook`);

        // Send order confirmation email
        await this.sendOrderConfirmationEmail(order.id);
      }
    } catch (error) {
      this.logger.error('Error processing Paystack webhook', error);
      throw error;
    }
  }

  /**
   * Send order confirmation email
   */
  private async sendOrderConfirmationEmail(orderId: string): Promise<void> {
    try {
      const order = await this.ordersRepository.findOne({
        where: { id: orderId },
        relations: ['user', 'tickets', 'event'],
      });

      if (!order || !order.user) {
        this.logger.warn(`Cannot send email: Order or user not found for ${orderId}`);
        return;
      }

      const eventDate = order.event?.start_date
        ? new Date(order.event.start_date).toLocaleDateString('en-KE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        : 'TBA';

      await this.emailService.sendOrderConfirmation({
        customerName: order.user.first_name || order.user.email,
        customerEmail: order.user.email,
        orderId: order.id,
        eventTitle: order.event?.title || 'Event',
        eventDate,
        eventLocation: order.event?.venue || 'TBA',
        ticketCount: order.tickets?.length || 1,
        totalAmount: Number(order.total_amount),
        currency: 'KES',
      });



      // Send Push Notification
      this.notificationsService.sendToUser(
        order.user_id,
        'Order Confirmed! 🎟️',
        `Your order for ${order.event?.title || 'Event'} has been confirmed!`,
        { type: 'ORDER_CONFIRMATION', orderId: order.id }
      ).catch(err => console.error('Push notification failed', err));

      this.logger.log(`Order confirmation email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send order confirmation email for ${orderId}:`, error);
      // Don't throw - email failure shouldn't break payment flow
    }
  }
}
