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
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('lottery_entries')
@Unique(['event_id', 'user_id']) // One entry per user per event
export class LotteryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  user_id: string;

  @Column({ default: false })
  is_winner: boolean;

  @Column({ type: 'timestamp', nullable: true })
  won_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Event, (event) => event.lottery_entries)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => User, (user) => user.lottery_entries)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
