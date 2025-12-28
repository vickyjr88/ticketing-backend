import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    const environment = this.configService.get('MPESA_ENVIRONMENT') || 'sandbox';
    this.baseUrl =
      environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth access token from Safaricom
   */
  private async getAccessToken(): Promise<string> {
    const consumerKey = this.configService.get('MPESA_CONSUMER_KEY');
    const consumerSecret = this.configService.get('MPESA_CONSUMER_SECRET');

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
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
  private generatePassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    const shortcode = this.configService.get('MPESA_SHORTCODE');
    const passkey = this.configService.get('MPESA_PASSKEY');

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    return { password, timestamp };
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async stkPush(phoneNumber: string, amount: number, orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    // Format phone number (remove + and ensure starts with 254)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
      BusinessShortCode: this.configService.get('MPESA_SHORTCODE'),
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: this.configService.get('MPESA_SHORTCODE'),
      PhoneNumber: formattedPhone,
      CallBackURL: this.configService.get('MPESA_CALLBACK_URL'),
      AccountReference: orderId,
      TransactionDesc: `Ticket Purchase - Order ${orderId}`,
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
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
    const { password, timestamp } = this.generatePassword();

    const payload = {
      BusinessShortCode: this.configService.get('MPESA_SHORTCODE'),
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
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
