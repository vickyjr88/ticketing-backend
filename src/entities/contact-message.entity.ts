import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum ContactMessageStatus {
    NEW = 'NEW',
    READ = 'READ',
    REPLIED = 'REPLIED',
    ARCHIVED = 'ARCHIVED',
}

export enum ContactSubject {
    GENERAL = 'GENERAL',
    SUPPORT = 'SUPPORT',
    TICKETING = 'TICKETING',
    EVENTS = 'EVENTS',
    PARTNERSHIP = 'PARTNERSHIP',
    REFUND = 'REFUND',
    OTHER = 'OTHER',
}

@Entity('contact_messages')
export class ContactMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({
        type: 'enum',
        enum: ContactSubject,
        default: ContactSubject.GENERAL,
    })
    subject: ContactSubject;

    @Column({ type: 'text' })
    message: string;

    @Column({
        type: 'enum',
        enum: ContactMessageStatus,
        default: ContactMessageStatus.NEW,
    })
    status: ContactMessageStatus;

    @Column({ type: 'text', nullable: true })
    admin_notes: string;

    @Column({ nullable: true })
    replied_by: string;

    @Column({ type: 'timestamptz', nullable: true })
    replied_at: Date;

    @Column({ nullable: true })
    ip_address: string;

    @Column({ nullable: true })
    user_agent: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
