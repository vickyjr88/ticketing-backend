import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Gate } from './gate.entity';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('gate_assignments')
@Unique(['gate', 'event']) // A gate can only be assigned once per event
export class GateAssignment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Gate, (gate) => gate.assignments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'gate_id' })
    gate: Gate;

    @Column()
    gate_id: string;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column()
    event_id: string;

    // Scanner assigned to this gate for this event
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'scanner_id' })
    scanner: User;

    @Column({ nullable: true })
    scanner_id: string;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
