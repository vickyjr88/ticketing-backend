import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatesController } from './gates.controller';
import { GatesService } from './gates.service';
import { Gate } from '../../entities/gate.entity';
import { GateAssignment } from '../../entities/gate-assignment.entity';
import { Event } from '../../entities/event.entity';
import { User } from '../../entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Gate, GateAssignment, Event, User])],
    controllers: [GatesController],
    providers: [GatesService],
    exports: [GatesService],
})
export class GatesModule { }
