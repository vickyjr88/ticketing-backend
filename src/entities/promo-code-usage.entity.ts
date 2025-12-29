import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PromoCode } from './promo-code.entity';
import { Order } from './order.entity';

@Entity('promo_code_usages')
export class PromoCodeUsage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    promo_code_id: string;

    @Column()
    user_id: string;

    @Column()
    order_id: string;

    @Column('decimal', { precision: 10, scale: 2 })
    discount_applied: number; // Actual discount amount applied

    @CreateDateColumn()
    used_at: Date;

    // Relations
    @ManyToOne(() => PromoCode)
    @JoinColumn({ name: 'promo_code_id' })
    promo_code: PromoCode;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Order)
    @JoinColumn({ name: 'order_id' })
    order: Order;
}
