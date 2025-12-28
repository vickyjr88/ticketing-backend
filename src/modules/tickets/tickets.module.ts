import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Order } from '../../entities/order.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketTier, Order]),
    EventsModule,
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
