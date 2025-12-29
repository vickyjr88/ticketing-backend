import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket]),
    TicketsModule,
    PaymentsModule,
    PromoModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule { }

