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

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED_AMOUNT = 'FIXED_AMOUNT',
}

@Entity('promo_codes')
export class PromoCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    code: string; // e.g., "EARLY10", "SAVE500"

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: DiscountType,
    })
    discount_type: DiscountType;

    @Column('decimal', { precision: 10, scale: 2 })
    discount_value: number; // 10 for 10% or 500 for KES 500

    @Column({ nullable: true })
    event_id: string; // Optional: restrict to specific event

    @Column({ type: 'int', nullable: true })
    usage_limit: number; // Max total uses (e.g., first 50)

    @Column({ type: 'int', default: 0 })
    usage_count: number; // Current usage count

    @Column({ type: 'int', nullable: true })
    per_user_limit: number; // Max uses per user (default: 1)

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    min_order_amount: number; // Minimum order value to apply

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    max_discount_amount: number; // Cap on discount (for percentage type)

    @Column({ type: 'timestamp', nullable: true })
    valid_from: Date;

    @Column({ type: 'timestamp', nullable: true })
    valid_until: Date; // Expiry date

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Event, { nullable: true })
    @JoinColumn({ name: 'event_id' })
    event: Event;
}
