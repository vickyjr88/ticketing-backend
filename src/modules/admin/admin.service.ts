import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Order, PaymentStatus } from '../../entities/order.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Event, EventStatus } from '../../entities/event.entity';
import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { LotteryEntry } from '../../entities/lottery-entry.entity';
import { CreateAdminUserDto } from './dto/user.dto';

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
        @InjectRepository(Ticket)
        private ticketRepository: Repository<Ticket>,
        @InjectRepository(LotteryEntry)
        private lotteryRepository: Repository<LotteryEntry>,
    ) { }

    async getDashboardStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalRevenue,
            totalTicketsSold,
            ticketsSoldToday,
            activeEvents,
            draftEvents,
            totalUsers,
            newUsersToday,
            pendingOrders,
            ticketsCheckedIn,
            lotteryEntries,
        ] = await Promise.all([
            // Total Revenue (only PAID orders)
            this.orderRepository
                .createQueryBuilder('order')
                .select('SUM(order.total_amount)', 'sum')
                .where('order.payment_status = :status', { status: PaymentStatus.PAID })
                .getRawOne()
                .then(result => parseInt(result.sum) || 0),

            // Total Tickets Sold
            this.ticketRepository.count(),

            // Tickets Sold Today
            this.ticketRepository.count({
                where: {
                    created_at: MoreThan(today)
                }
            }),

            // Active Events
            this.eventRepository.count({ where: { status: EventStatus.PUBLISHED } }),

            // Draft Events
            this.eventRepository.count({ where: { status: EventStatus.DRAFT } }),

            // Total Users
            this.userRepository.count(),

            // New Users Today
            this.userRepository.count({
                where: {
                    created_at: MoreThan(today)
                }
            }),

            // Pending Orders
            this.orderRepository.count({ where: { payment_status: PaymentStatus.PENDING } }),

            // Checked In Today
            this.ticketRepository.count({
                where: {
                    status: TicketStatus.REDEEMED,
                    updated_at: MoreThan(today)
                }
            }),

            // Total Lottery Entries
            this.lotteryRepository.count()
        ]);

        // Calculate conversion rate (orders / users)
        const conversionRate = totalUsers > 0
            ? Math.round(((await this.orderRepository.count()) / totalUsers) * 100)
            : 0;

        return {
            totalRevenue,
            totalTicketsSold,
            ticketsSoldToday,
            activeEvents,
            draftEvents,
            totalUsers,
            newUsersToday,
            pendingOrders,
            ticketsCheckedIn,
            lotteryEntries,
            conversionRate: `${conversionRate}%`
        };
    }

    async getOrders(page: number = 1, limit: number = 15, status?: string) {
        const skip = (page - 1) * limit;

        // 1. Get IDs for the current page to properly handle OneToMany pagination
        const idQuery = this.orderRepository.createQueryBuilder('order')
            .select('order.id')
            .orderBy('order.created_at', 'DESC')
            .addOrderBy('order.id', 'DESC') // Deterministic sort
            .skip(skip)
            .take(limit);

        if (status) {
            idQuery.where('order.payment_status = :status', { status });
        }

        const [idResults, total] = await idQuery.getManyAndCount();
        const ids = idResults.map((o) => o.id);

        if (ids.length === 0) {
            return {
                orders: [],
                total,
                page,
                totalPages: Math.ceil(total / limit),
            };
        }

        // 2. Fetch full data for these IDs
        const orders = await this.orderRepository
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.user', 'user')
            .leftJoinAndSelect('order.tickets', 'tickets')
            .leftJoinAndSelect('order.event', 'event')
            .leftJoinAndSelect('tickets.tier', 'tier')   // Load tier from tickets
            .where('order.id IN (:...ids)', { ids })
            .orderBy('order.created_at', 'DESC')
            .addOrderBy('order.id', 'DESC')
            .getMany();

        const mappedOrders = orders.map((order) => {
            // Safely get tier from first ticket if it exists
            const firstTicket =
                order.tickets && order.tickets.length > 0 ? order.tickets[0] : null;

            const tier = firstTicket?.tier || null;

            return {
                id: order.id,
                user_id: order.user_id,
                total_amount: order.total_amount,
                payment_status: order.payment_status,
                payment_provider: order.payment_provider,
                provider_ref: order.provider_ref,
                paid_at: order.paid_at,
                created_at: order.created_at,
                updated_at: order.updated_at,
                user: order.user
                    ? {
                        id: order.user.id,
                        email: order.user.email,
                        first_name: order.user.first_name,
                        last_name: order.user.last_name,
                    }
                    : null,
                tickets_count: order.tickets?.length || 0,
                status: order.payment_status,
                event: order.event ? { id: order.event.id, title: order.event.title } : null,
                tier: tier ? { id: tier.id, name: tier.name } : null,
            };
        });

        return {
            orders: mappedOrders,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getUsers(page: number = 1, limit: number = 15, role?: string, search?: string) {
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRepository.createQueryBuilder('user')
            .orderBy('user.created_at', 'DESC')
            .skip(skip)
            .take(limit);

        if (role) {
            queryBuilder.andWhere('user.role = :role', { role });
        }

        if (search?.trim()) {
            const q = `%${search.trim().toLowerCase()}%`;
            queryBuilder.andWhere(
                '(LOWER(user.email) LIKE :q OR LOWER(COALESCE(user.first_name, \'\')) LIKE :q OR LOWER(COALESCE(user.last_name, \'\')) LIKE :q OR COALESCE(user.phone_number, \'\') LIKE :q)',
                { q },
            );
        }

        const [users, total] = await queryBuilder.getManyAndCount();

        const roleCountsRaw = await this.userRepository
            .createQueryBuilder('user')
            .select('user.role', 'role')
            .addSelect('COUNT(*)', 'count')
            .groupBy('user.role')
            .getRawMany();

        const counts = {
            total: 0,
            USER: 0,
            ADMIN: 0,
            SCANNER: 0,
        };
        for (const row of roleCountsRaw) {
            const count = parseInt(row.count, 10) || 0;
            counts[row.role] = count;
            counts.total += count;
        }

        return {
            users: users.map((user) => this.sanitizeUser(user)),
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            counts,
        };
    }

    async getUser(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return this.sanitizeUser(user);
    }

    async updateUser(userId: string, dto: {
        email?: string;
        first_name?: string;
        last_name?: string;
        phone_number?: string;
        role?: UserRole;
        assigned_gate?: string;
        is_active?: boolean;
    }) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (dto.email !== undefined) {
            const email = dto.email.trim().toLowerCase();
            const existing = await this.userRepository
                .createQueryBuilder('user')
                .where('LOWER(user.email) = :email', { email })
                .andWhere('user.id != :id', { id: userId })
                .getOne();
            if (existing) {
                throw new ConflictException('User with this email already exists');
            }
            user.email = email;
        }
        if (dto.first_name !== undefined) {
            user.first_name = dto.first_name?.trim() || null;
        }
        if (dto.last_name !== undefined) {
            user.last_name = dto.last_name?.trim() || null;
        }
        if (dto.phone_number !== undefined) {
            user.phone_number = dto.phone_number?.trim() || null;
        }
        if (dto.role !== undefined) {
            user.role = dto.role;
            if (dto.role !== UserRole.SCANNER) {
                user.assigned_gate = null;
            }
        }
        if (dto.assigned_gate !== undefined) {
            user.assigned_gate = user.role === UserRole.SCANNER
                ? dto.assigned_gate?.trim() || null
                : null;
        }
        if (dto.is_active !== undefined) {
            user.is_active = dto.is_active;
        }

        const saved = await this.userRepository.save(user);
        return this.sanitizeUser(saved);
    }

    async createUser(dto: CreateAdminUserDto) {
        const email = dto.email.trim().toLowerCase();
        const existing = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(user.email) = :email', { email })
            .getOne();
        if (existing) {
            throw new ConflictException('User with this email already exists');
        }

        const role = dto.role || UserRole.USER;
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = this.userRepository.create({
            email,
            password: hashedPassword,
            first_name: dto.first_name?.trim() || null,
            last_name: dto.last_name?.trim() || null,
            phone_number: dto.phone_number?.trim() || null,
            role,
            assigned_gate: role === UserRole.SCANNER ? dto.assigned_gate?.trim() || null : null,
            is_active: true,
        });

        const saved = await this.userRepository.save(user);
        return this.sanitizeUser(saved);
    }

    async setUserPassword(userId: string, password: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.password = await bcrypt.hash(password, 10);
        user.reset_password_token = null;
        user.reset_password_expires = null;
        await this.userRepository.save(user);
        return { message: 'Password updated' };
    }

    async updateUserRole(userId: string, role: UserRole) {
        return this.userRepository.update(userId, { role });
    }

    async updateUserStatus(userId: string, isActive: boolean) {
        return this.userRepository.update(userId, { is_active: isActive });
    }

    async updateUserGate(userId: string, gate: string) {
        return this.userRepository.update(userId, { assigned_gate: gate });
    }

    private sanitizeUser(user: User) {
        const {
            password,
            reset_password_token,
            reset_password_expires,
            fcm_token,
            ...safe
        } = user;
        return safe;
    }
}
