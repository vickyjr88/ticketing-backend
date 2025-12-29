import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { Waitlist } from '../../entities/waitlist.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Event } from '../../entities/event.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Waitlist, TicketTier, Event]),
    ],
    controllers: [WaitlistController],
    providers: [WaitlistService],
    exports: [WaitlistService],
})
export class WaitlistModule { }

