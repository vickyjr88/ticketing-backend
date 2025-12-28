import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Ticket } from './ticket.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  MPESA = 'MPESA',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PAYSTACK = 'PAYSTACK',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  payment_status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  payment_provider: PaymentProvider;

  @Column({ nullable: true })
  provider_ref: string; // External payment reference

  @Column({ type: 'jsonb', nullable: true })
  payment_metadata: any; // Store additional payment info

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets: Ticket[];
}
