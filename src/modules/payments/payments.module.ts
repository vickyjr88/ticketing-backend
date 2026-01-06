import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MpesaService } from './services/mpesa.service';
import { StripeService } from './services/stripe.service';
import { PaystackService } from './services/paystack.service';
import { OrdersModule } from '../orders/orders.module';

import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentSettingsController } from './payment-settings.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, PaymentConfig]),
    forwardRef(() => OrdersModule),
    NotificationsModule,
  ],
  providers: [
    PaymentsService,
    MpesaService,
    StripeService,
    PaystackService,
    PaymentSettingsService
  ],
  controllers: [PaymentsController, PaymentSettingsController],
  exports: [PaymentsService, MpesaService, StripeService, PaystackService, PaymentSettingsService],
})
export class PaymentsModule { }
