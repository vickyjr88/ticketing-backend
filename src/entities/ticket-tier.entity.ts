import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

export enum TierCategory {
  REGULAR = 'REGULAR',
  VIP = 'VIP',
  VVIP = 'VVIP',
  STUDENT = 'STUDENT',
}

@Entity('ticket_tiers')
export class TicketTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  name: string; // e.g., "Die Hard Early Bird", "Flash Sale 50% Off", "Mukuu VVIP"

  @Column({
    type: 'enum',
    enum: TierCategory,
    default: TierCategory.REGULAR,
  })
  category: TierCategory;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 1 })
  tickets_per_unit: number; // How many actual tickets this tier generates (e.g., 10 for a table)

  @Column()
  initial_quantity: number; // Units available

  @Column()
  remaining_quantity: number; // Managed via atomic decrements

  @Column({ default: 10 })
  max_qty_per_order: number; // Limit scalping

  @Column({ type: 'timestamp', nullable: true })
  sales_start: Date; // Crucial for "Flash Sales" (start time)

  @Column({ type: 'timestamp', nullable: true })
  sales_end: Date; // Crucial for "Die Hard" (cutoff time)

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Event, (event) => event.ticket_tiers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;
}
