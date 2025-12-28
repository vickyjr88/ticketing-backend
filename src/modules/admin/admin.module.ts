import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { Event } from '../../entities/event.entity';
import { Ticket } from '../../entities/ticket.entity';
import { LotteryEntry } from '../../entities/lottery-entry.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order, User, Event, Ticket, LotteryEntry]),
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
