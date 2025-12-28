import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    amount: number,
    orderId: string,
    currency: string = 'usd',
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency,
        metadata: {
          orderId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`Payment intent created for order ${orderId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw new BadRequestException('Failed to initialize Stripe payment');
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(
    amount: number,
    orderId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Event Tickets',
                description: `Order ${orderId}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId,
        },
      });

      this.logger.log(`Checkout session created for order ${orderId}`);
      return session;
    } catch (error) {
      this.logger.error('Failed to create checkout session', error);
      throw new BadRequestException('Failed to create Stripe checkout session');
    }
  }

  /**
   * Verify webhook signature and process webhook events
   */
  processWebhook(
    payload: string | Buffer,
    signature: string,
  ): {
    success: boolean;
    orderId: string;
    transactionId: string;
    amount: number;
  } {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
          return {
            success: true,
            orderId: paymentIntent.metadata.orderId,
            transactionId: paymentIntent.id,
            amount: paymentIntent.amount / 100,
          };

        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          this.logger.log(`Checkout session completed: ${session.id}`);
          return {
            success: true,
            orderId: session.metadata.orderId,
            transactionId: session.id,
            amount: session.amount_total / 100,
          };

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object as Stripe.PaymentIntent;
          this.logger.warn(`Payment failed: ${failedIntent.id}`);
          return {
            success: false,
            orderId: failedIntent.metadata.orderId,
            transactionId: failedIntent.id,
            amount: 0,
          };

        default:
          this.logger.warn(`Unhandled event type: ${event.type}`);
          return null;
      }
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Retrieve payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error('Failed to retrieve payment intent', error);
      throw new BadRequestException('Payment not found');
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      this.logger.log(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error('Failed to create refund', error);
      throw new BadRequestException('Failed to process refund');
    }
  }
}
