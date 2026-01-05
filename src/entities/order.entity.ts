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
import { OrderProduct } from './order-product.entity';
import { PartialPayment } from './partial-payment.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL', // For Lipa Pole Pole
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  MPESA = 'MPESA',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PAYSTACK = 'PAYSTACK',
  COMPLIMENTARY = 'COMPLIMENTARY',
}

export enum PaymentType {
  FULL = 'FULL',
  LIPA_POLE_POLE = 'LIPA_POLE_POLE',
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

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.FULL,
  })
  payment_type: PaymentType;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount_paid: number; // Total amount paid so far (for Lipa Pole Pole)

  @Column({ nullable: true })
  provider_ref: string; // External payment reference

  @Column({ type: 'jsonb', nullable: true })
  payment_metadata: any; // Store additional payment info

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @Column({ nullable: true })
  promo_code_id: string; // Applied promo code

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  discount_amount: number; // Amount discounted

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  subtotal: number; // Original amount before discount

  @Column({ type: 'timestamp', nullable: true })
  layaway_deadline: Date; // Optional deadline for Lipa Pole Pole payments

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

  @OneToMany(() => OrderProduct, (op) => op.order, { cascade: true })
  order_products: OrderProduct[];

  @OneToMany(() => PartialPayment, (pp) => pp.order)
  partial_payments: PartialPayment[];

  // Computed property for balance due
  get balance_due(): number {
    return Number(this.total_amount) - Number(this.amount_paid || 0);
  }

  get is_fully_paid(): boolean {
    return Number(this.amount_paid || 0) >= Number(this.total_amount);
  }

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
