import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryEntry } from '../../entities/lottery-entry.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { LotteryService } from './lottery.service';
import { LotteryController } from './lottery.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LotteryEntry, Ticket, Event])],
  providers: [LotteryService],
  controllers: [LotteryController],
  exports: [LotteryService],
})
export class LotteryModule {}
