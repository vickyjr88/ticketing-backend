import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('media')
export class Media {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column()
    key: string;

    @Column()
    filename: string;

    @Column()
    mimetype: string;

    @Column()
    size: number;

    @CreateDateColumn()
    created_at: Date;
}
