import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from './user.entity';
import { Ticket } from './ticket.entity';
import { Event } from './event.entity';

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

  @Column()
  event_id: string;

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

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets: Ticket[];

  @BeforeInsert()
  @BeforeUpdate()
  setDefaultPaymentStatus() {
    // Prevent string "undefined" or invalid values from being stored
    if (!this.payment_status || 
        this.payment_status === 'undefined' as any || 
        !Object.values(PaymentStatus).includes(this.payment_status)) {
      this.payment_status = PaymentStatus.PENDING;
    }
  }
}
