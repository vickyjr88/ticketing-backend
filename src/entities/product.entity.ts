import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

export enum ProductType {
    MERCH = 'MERCH',
    PARKING = 'PARKING',
    BEVERAGE = 'BEVERAGE',
    SNACK = 'SNACK',
    OTHER = 'OTHER',
}

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    event_id: string;

    @Column()
    name: string;

    @Column('text')
    description: string;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;

    @Column({ default: 0 })
    stock: number;

    @Column({ nullable: true })
    image_url: string;

    @Column({
        type: 'enum',
        enum: ProductType,
        default: ProductType.OTHER,
    })
    type: ProductType;

    @Column({ default: true })
    active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @ManyToOne(() => Event, (event) => event.products)
    @JoinColumn({ name: 'event_id' })
    event: Event;
}
