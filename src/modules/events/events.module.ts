import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../entities/event.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { S3Service } from '../../services/s3.service';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Event, TicketTier])],
  providers: [EventsService, S3Service, EventsGateway],
  controllers: [EventsController],
  exports: [EventsService, EventsGateway],
})
export class EventsModule { }
