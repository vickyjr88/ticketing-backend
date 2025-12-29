import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { LotteryEntry } from './lottery-entry.entity';
import { Event } from './event.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SCANNER = 'SCANNER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Ticket, (ticket) => ticket.purchaser)
  purchased_tickets: Ticket[];

  @OneToMany(() => Ticket, (ticket) => ticket.holder)
  held_tickets: Ticket[];

  @OneToMany(() => LotteryEntry, (entry) => entry.user)
  lottery_entries: LotteryEntry[];

  @OneToMany(() => Event, (event) => event.user)
  created_events: Event[];

  @Column({ nullable: true })
  assigned_gate: string; // For scanners

  @Column({ nullable: true })
  @Exclude()
  reset_password_token: string;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  reset_password_expires: Date;
}
