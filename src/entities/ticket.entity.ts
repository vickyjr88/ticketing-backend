import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from './event.entity';
import { TicketTier } from './ticket-tier.entity';
import { Order } from './order.entity';
import { User } from './user.entity';

export enum TicketType {
  STANDARD = 'STANDARD', // Regular purchased ticket
  ADOPTED = 'ADOPTED', // Gifted/donated ticket
}

export enum TicketStatus {
  PENDING = 'PENDING', // Reserved but not paid
  ISSUED = 'ISSUED', // Ticket issued to purchaser
  POOL = 'POOL', // In lottery pool (for adopted tickets)
  WON = 'WON', // Won in lottery, assigned to winner
  REDEEMED = 'REDEEMED', // Ticket used/checked-in at event
  CANCELLED = 'CANCELLED', // Ticket cancelled/refunded
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  tier_id: string;

  @Column({ nullable: true })
  order_id: string;

  @Column()
  purchaser_id: string; // Who bought/donated the ticket

  @Column({ nullable: true })
  holder_id: string; // Who currently holds the ticket (for lottery winners)

  @Column({
    type: 'enum',
    enum: TicketType,
    default: TicketType.STANDARD,
  })
  type: TicketType;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ISSUED,
  })
  status: TicketStatus;

  @Column({ unique: true })
  @Index()
  qr_code_hash: string; // Unique QR code identifier

  @Column({ type: 'timestamp', nullable: true })
  checked_in_at: Date;

  @Column({ nullable: true })
  checked_in_by: string; // Scanner user ID

  @Column({ nullable: true })
  checked_in_gate: string; // Gate name at check-in

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Event, (event) => event.tickets)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => TicketTier)
  @JoinColumn({ name: 'tier_id' })
  tier: TicketTier;

  @ManyToOne(() => Order, (order) => order.tickets)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User, (user) => user.purchased_tickets)
  @JoinColumn({ name: 'purchaser_id' })
  purchaser: User;

  @ManyToOne(() => User, (user) => user.held_tickets)
  @JoinColumn({ name: 'holder_id' })
  holder: User;
}
