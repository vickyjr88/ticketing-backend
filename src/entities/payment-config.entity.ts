import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    CreateDateColumn,
} from 'typeorm';
import { PaymentProvider } from './order.entity';

@Entity('payment_configs')
export class PaymentConfig {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: PaymentProvider,
        unique: true
    })
    provider: PaymentProvider;

    @Column({ default: false })
    is_enabled: boolean;

    @Column({ type: 'jsonb', nullable: true })
    credentials: any;

    @Column({ default: false })
    is_test_mode: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
