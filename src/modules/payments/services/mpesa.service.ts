import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PaymentSettingsService } from '../payment-settings.service';
import { PaymentProvider } from '../../../entities/order.entity';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private configService: ConfigService,
    private paymentSettingsService: PaymentSettingsService
  ) { }

  private getBaseUrl(isTest: boolean): string {
    return isTest
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';
  }

  private async getConfig() {
    const dbConfig = await this.paymentSettingsService.getConfig(PaymentProvider.MPESA);
    let creds: any = {};
    let isTest = true;

    // Determine credentials source
    // If DB config exists, use it. But maintain fallback for individual fields if missing.
    // E.g. User enabled it but didn't type keys.
    if (dbConfig) {
      creds = dbConfig.credentials || {};
      // If explicitly enabled/disabled in DB, respect the mode. 
      // If enabled/test mode set, use that.
      // Note: "is_enabled" check is tricky if service is called. Usually caller checks enabled properly.
      // Here we just want the VALUES.
      isTest = dbConfig.is_test_mode;
    } else {
      // No DB config row at all -> Pure Env fallback
      const env = this.configService.get('MPESA_ENVIRONMENT');
      isTest = env !== 'production';
    }

    // Merge values (DB > Env)
    return {
      consumerKey: creds.consumerKey || this.configService.get('MPESA_CONSUMER_KEY'),
      consumerSecret: creds.consumerSecret || this.configService.get('MPESA_CONSUMER_SECRET'),
      passkey: creds.passkey || this.configService.get('MPESA_PASSKEY'),
      shortcode: creds.shortcode || this.configService.get('MPESA_SHORTCODE'),
      callbackUrl: this.configService.get('MPESA_CALLBACK_URL'), // Usually static per env
      baseUrl: this.getBaseUrl(isTest)
    };
  }

  /**
   * Get OAuth access token from Safaricom
   */
  private async getAccessToken(): Promise<string> {
    const config = await this.getConfig();
    const { consumerKey, consumerSecret, baseUrl } = config;

    if (!consumerKey || !consumerSecret) {
      throw new BadRequestException('M-Pesa credentials not configured');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to get M-Pesa access token', error);
      throw new BadRequestException('Failed to initialize M-Pesa payment');
    }
  }

  /**
   * Generate password for STK Push
   */
  private async generatePassword() {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    const config = await this.getConfig();
    const { shortcode, passkey } = config;

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    return { password, timestamp, config };
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async stkPush(phoneNumber: string, amount: number, orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const { password, timestamp, config } = await this.generatePassword();
    const { shortcode, callbackUrl, baseUrl } = config;

    // Format phone number (remove + and ensure starts with 254)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderId,
      TransactionDesc: `Ticket Purchase - Order ${orderId}`,
    };

    try {
      const response = await axios.post(
        `${baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`STK Push initiated for order ${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error('STK Push failed', error.response?.data || error);
      throw new BadRequestException('Failed to initiate M-Pesa payment');
    }
  }

  /**
   * Process M-Pesa callback
   */
  processCallback(callbackData: any): {
    success: boolean;
    orderId: string;
    transactionId: string;
    amount: number;
  } {
    try {
      const { Body } = callbackData;
      const { stkCallback } = Body;

      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      if (resultCode !== 0) {
        this.logger.warn(`M-Pesa payment failed: ${resultDesc}`);
        return {
          success: false,
          orderId: null,
          transactionId: null,
          amount: 0,
        };
      }

      // Extract callback metadata
      const metadata = stkCallback.CallbackMetadata.Item;
      const amount = metadata.find((item) => item.Name === 'Amount')?.Value;
      const transactionId = metadata.find(
        (item) => item.Name === 'MpesaReceiptNumber',
      )?.Value;
      const phoneNumber = metadata.find((item) => item.Name === 'PhoneNumber')?.Value;

      // Extract order ID from MerchantRequestID or CheckoutRequestID
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      this.logger.log(`M-Pesa payment successful: ${transactionId}`);

      return {
        success: true,
        orderId: checkoutRequestId, // You may need to map this to your actual orderId
        transactionId,
        amount,
      };
    } catch (error) {
      this.logger.error('Failed to process M-Pesa callback', error);
      throw new BadRequestException('Invalid callback data');
    }
  }

  /**
   * Query transaction status
   */
  async queryTransaction(checkoutRequestId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const { password, timestamp, config } = await this.generatePassword();
    const { shortcode, baseUrl } = config;

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await axios.post(
        `${baseUrl}/mpesa/stkpushquery/v1/query`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Transaction query failed', error);
      throw new BadRequestException('Failed to query transaction status');
    }
  }
}
