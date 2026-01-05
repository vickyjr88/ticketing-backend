import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayawayController } from './layaway.controller';
import { LayawayService } from './layaway.service';
import { Order } from '../../entities/order.entity';
import { PartialPayment } from '../../entities/partial-payment.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Product } from '../../entities/product.entity';
import { OrderProduct } from '../../entities/order-product.entity';
import { EventsModule } from '../events/events.module';
import { PromoModule } from '../promo/promo.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Order,
            PartialPayment,
            TicketTier,
            Ticket,
            Product,
            OrderProduct,
        ]),
        EventsModule,
        PromoModule,
        PaymentsModule,
    ],
    controllers: [LayawayController],
    providers: [LayawayService],
    exports: [LayawayService],
})
export class LayawayModule { }
