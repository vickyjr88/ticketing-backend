import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentProvider, PaymentStatus } from '../../entities/order.entity';
import { MpesaService } from './services/mpesa.service';
import { StripeService } from './services/stripe.service';
import { PaystackService } from './services/paystack.service';




@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private mpesaService: MpesaService,
    private stripeService: StripeService,
    private paystackService: PaystackService,
  ) { }

  /**
   * Initiate payment based on provider
   */
  async initiatePayment(
    orderId: string,
    phoneNumber?: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }

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
        if (!order.user?.email) {
          throw new BadRequestException('User email required for Paystack');
        }
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
   * Handle M-Pesa callback (idempotent)
   */
  async handleMpesaCallback(callbackData: any): Promise<void> {
    const result = this.mpesaService.processCallback(callbackData);

    if (result.success) {
      // Find order by transaction reference
      // Note: You may need to store checkoutRequestId in order metadata
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

      // Update order
      order.payment_status = PaymentStatus.PAID;
      order.provider_ref = result.transactionId;
      order.paid_at = new Date();
      order.payment_metadata = callbackData;

      await this.ordersRepository.save(order);
      this.logger.log(`Order ${order.id} marked as paid via M-Pesa`);
    }
  }

  /**
   * Handle Stripe webhook (idempotent)
   */
  async handleStripeWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const result = this.stripeService.processWebhook(payload, signature);

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

    // Update order
    if (result.success) {
      order.payment_status = PaymentStatus.PAID;
      order.provider_ref = result.transactionId;
      order.paid_at = new Date();
    } else {
      order.payment_status = PaymentStatus.FAILED;
    }

    await this.ordersRepository.save(order);
    this.logger.log(
      `Order ${order.id} payment status updated to ${order.payment_status}`,
    );
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
          order.payment_status = PaymentStatus.PAID;
          order.provider_ref = result.data.reference;
          order.paid_at = new Date();
          order.payment_metadata = result.data;
          await this.ordersRepository.save(order);
          this.logger.log(`Order ${order.id} marked as paid via Paystack`);
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

        // Update order
        order.payment_status = PaymentStatus.PAID;
        order.provider_ref = data.reference;
        order.paid_at = new Date();
        order.payment_metadata = data;

        await this.ordersRepository.save(order);
        this.logger.log(`Order ${order.id} marked as paid via Paystack webhook`);
      }
    } catch (error) {
      this.logger.error('Error processing Paystack webhook', error);
      throw error;
    }
  }
}
