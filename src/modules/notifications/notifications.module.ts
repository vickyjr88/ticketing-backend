import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
    imports: [TypeOrmModule.forFeature([User, Ticket, Event])],
    providers: [NotificationsService],
    controllers: [NotificationsController],
    exports: [NotificationsService]
})
export class NotificationsModule { }
