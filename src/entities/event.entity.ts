import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TicketTier } from './ticket-tier.entity';
import { Ticket } from './ticket.entity';
import { LotteryEntry } from './lottery-entry.entity';
import { User } from './user.entity';
import { Product } from './product.entity';

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED', // Admin-only status
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  venue: string;

  @Column({ type: 'timestamp' })
  start_date: Date;

  @Column({ type: 'timestamp' })
  end_date: Date;

  @Column({ nullable: true })
  banner_image_url: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ default: false })
  lottery_enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lottery_draw_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => TicketTier, (tier) => tier.event, { cascade: true })
  ticket_tiers: TicketTier[];

  @OneToMany(() => Ticket, (ticket) => ticket.event)
  tickets: Ticket[];

  @OneToMany(() => LotteryEntry, (entry) => entry.event)
  lottery_entries: LotteryEntry[];

  @OneToMany(() => Product, (product) => product.event)
  products: Product[];

  @ManyToOne(() => User, (user) => user.created_events)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  user_id: string;
}
