import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Event } from './event.entity';
import { TicketTier } from './ticket-tier.entity';
import { User } from './user.entity';

@Entity('waitlists')
@Index(['email', 'tier_id'], { unique: true }) // Prevent duplicate signups for same tier
export class Waitlist {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    phone_number: string;

    @Column({ name: 'event_id' })
    event_id: string;

    @ManyToOne(() => Event)
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ name: 'tier_id' })
    tier_id: string;

    @ManyToOne(() => TicketTier)
    @JoinColumn({ name: 'tier_id' })
    tier: TicketTier;

    @Column({ name: 'user_id', nullable: true })
    user_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn()
    created_at: Date;

    @Column({ default: false })
    notified: boolean;
}
