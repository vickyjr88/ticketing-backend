import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MpesaService } from './services/mpesa.service';
import { StripeService } from './services/stripe.service';
import { PaystackService } from './services/paystack.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [PaymentsService, MpesaService, StripeService, PaystackService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule { }
