import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaystackService {
    private readonly logger = new Logger(PaystackService.name);
    private readonly baseUrl = 'https://api.paystack.co';

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get('PAYSTACK_SECRET_KEY');
        if (!apiKey) {
            this.logger.error('PAYSTACK_SECRET_KEY is not configured');
        } else {
            this.logger.log('Paystack service initialized with key: ' + apiKey.substring(0, 10) + '...');
        }
    }

    private getHeaders() {
        const apiKey = this.configService.get('PAYSTACK_SECRET_KEY');
        if (!apiKey) {
            throw new BadRequestException('Paystack API key is not configured');
        }
        return {
            Authorization: `Bearer ${apiKey}`,
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
            const apiKey = this.configService.get('PAYSTACK_SECRET_KEY');
            
            // Handle dummy/development key
            if (apiKey === 'dummy-key-for-development') {
                this.logger.log('Using dummy Paystack key - returning mock response');
                return {
                    status: true,
                    message: 'Authorization URL created (mock)',
                    data: {
                        authorization_url: `https://checkout.paystack.com/mock-${orderId}`,
                        access_code: 'mock_access_code',
                        reference: `ORDER_${orderId}_${Date.now()}`,
                    },
                };
            }

            // Get currency from config or default to NGN (Nigerian Naira)
            // Paystack supports: NGN, GHS, ZAR, USD
            const currency = this.configService.get('PAYSTACK_CURRENCY') || 'NGN';
            
            // Paystack expects amount in kobo/cents (multiply by 100)
            const payload = {
                email,
                amount: Math.round(amount * 100),
                reference: `ORDER_${orderId}_${Date.now()}`,
                callback_url: callbackUrl,
                metadata: {
                    order_id: orderId,
                },
                currency,
            };

            this.logger.log(`Initializing Paystack transaction: email=${email}, amount=${amount}, currency=${currency}, reference=${payload.reference}`);

            const response = await axios.post(
                `${this.baseUrl}/transaction/initialize`,
                payload,
                {
                    headers: this.getHeaders(),
                },
            );

            this.logger.log(`Paystack initialized successfully: ${response.data.data?.authorization_url}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Paystack initialization failed: ${error.response?.data?.message || error.message}`, error.response?.data);
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
            const apiKey = this.configService.get('PAYSTACK_SECRET_KEY');
            
            // Handle dummy/development key
            if (apiKey === 'dummy-key-for-development') {
                this.logger.log('Using dummy Paystack key - returning mock verification');
                return {
                    status: true,
                    message: 'Verification successful (mock)',
                    data: {
                        reference,
                        amount: 2500, // Mock amount in kobo
                        status: 'success',
                        gateway_response: 'Successful (mock)',
                        paid_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        channel: 'card',
                        currency: 'NGN',
                        authorization: {
                            authorization_code: 'mock_auth_code',
                            bin: '408408',
                            last4: '4081',
                            exp_month: '12',
                            exp_year: '2030',
                            channel: 'card',
                            card_type: 'visa',
                            bank: 'TEST BANK',
                            country_code: 'NG',
                            brand: 'visa',
                        },
                        customer: {
                            email: 'test@example.com',
                        },
                    },
                };
            }

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
