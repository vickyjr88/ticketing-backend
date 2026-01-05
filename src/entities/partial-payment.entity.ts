import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum PartialPaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

@Entity('partial_payments')
export class PartialPayment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    order_id: string;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: PartialPaymentStatus,
        default: PartialPaymentStatus.PENDING,
    })
    status: PartialPaymentStatus;

    @Column({ nullable: true })
    payment_provider: string;

    @Column({ nullable: true })
    transaction_reference: string;

    @Column({ nullable: true })
    phone_number: string;

    @Column({ type: 'jsonb', nullable: true })
    payment_metadata: any;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date;

    @CreateDateColumn()
    created_at: Date;

    // Relations
    @ManyToOne(() => Order, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: Order;
}
