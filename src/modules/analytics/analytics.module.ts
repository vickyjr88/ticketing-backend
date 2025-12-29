import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { User } from '../../entities/user.entity';
import { Event } from '../../entities/event.entity';
import { LotteryEntry } from '../../entities/lottery-entry.entity';
import { Waitlist } from '../../entities/waitlist.entity';
import { PromoCodeUsage } from '../../entities/promo-code-usage.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Order,
            Ticket,
            User,
            Event,
            LotteryEntry,
            Waitlist,
            PromoCodeUsage,
        ]),
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
