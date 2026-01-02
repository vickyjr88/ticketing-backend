import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  RawBodyRequest,
  Req,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) { }

  @UseGuards(JwtAuthGuard)
  @Post('initiate/:orderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for an order' })
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(
      orderId,
      dto.phoneNumber,
      dto.successUrl,
      dto.cancelUrl,
      dto.paymentProvider,
    );
  }

  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Don't expose in Swagger
  async mpesaCallback(@Body() callbackData: any) {
    await this.paymentsService.handleMpesaCallback(callbackData);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Don't expose in Swagger
  async stripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const payload = req.rawBody;
    await this.paymentsService.handleStripeWebhook(payload, signature);
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('paystack/verify/:reference')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Paystack payment' })
  async verifyPaystack(@Param('reference') reference: string) {
    return this.paymentsService.verifyPaystackTransaction(reference);
  }

  @Post('paystack/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Don't expose in Swagger
  async paystackWebhook(@Body() webhookData: any) {
    await this.paymentsService.handlePaystackWebhook(webhookData);
    return { status: 'success' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:orderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check payment status' })
  async checkStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.checkPaymentStatus(orderId);
  }
}
