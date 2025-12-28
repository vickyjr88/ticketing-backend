import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaystackService {
    private readonly logger = new Logger(PaystackService.name);
    private readonly baseUrl = 'https://api.paystack.co';

    constructor(private configService: ConfigService) { }

    private getHeaders() {
        return {
            Authorization: `Bearer ${this.configService.get('PAYSTACK_SECRET_KEY')}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Initialize Paystack Transaction
     */
    async initializeTransaction(
        email: string,
        amount: number,
        orderId: string,
        callbackUrl?: string,
    ): Promise<any> {
        try {
            // Paystack expects amount in kobo/cents (multiply by 100)
            const payload = {
                email,
                amount: Math.round(amount * 100),
                reference: `ORDER_${orderId}_${Date.now()}`,
                callback_url: callbackUrl,
                metadata: {
                    order_id: orderId,
                },
                currency: 'KES', // Or Configurable
            };

            const response = await axios.post(
                `${this.baseUrl}/transaction/initialize`,
                payload,
                {
                    headers: this.getHeaders(),
                },
            );

            return response.data;
        } catch (error) {
            this.logger.error('Paystack initialization failed', error.response?.data || error);
            throw new BadRequestException(
                error.response?.data?.message || 'Failed to initialize Paystack payment',
            );
        }
    }

    /**
     * Verify Paystack Transaction
     */
    async verifyTransaction(reference: string): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/transaction/verify/${reference}`,
                {
                    headers: this.getHeaders(),
                },
            );

            return response.data;
        } catch (error) {
            this.logger.error('Paystack verification failed', error.response?.data || error);
            throw new BadRequestException('Failed to verify Paystack payment');
        }
    }
}
