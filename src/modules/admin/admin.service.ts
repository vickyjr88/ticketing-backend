import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { Order, PaymentStatus } from '../../entities/order.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Event, EventStatus } from '../../entities/event.entity';
import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { LotteryEntry } from '../../entities/lottery-entry.entity';

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
            .leftJoinAndSelect('tickets.event', 'event') // Load event from tickets
            .leftJoinAndSelect('tickets.tier', 'tier')   // Load tier from tickets
            .where('order.id IN (:...ids)', { ids })
            .orderBy('order.created_at', 'DESC')
            .addOrderBy('order.id', 'DESC')
            .getMany();

        const mappedOrders = orders.map((order) => {
            // Safely get event and tier from first ticket if it exists
            const firstTicket =
                order.tickets && order.tickets.length > 0 ? order.tickets[0] : null;

            // In case ticket exists but relation is null (shouldn't happen with correct DB)
            const event = firstTicket?.event || null;
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
                event: event ? { id: event.id, title: event.title } : null,
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

    async getUsers(page: number = 1, limit: number = 15, role?: string) {
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRepository.createQueryBuilder('user')
            .orderBy('user.created_at', 'DESC')
            .skip(skip)
            .take(limit);

        if (role) {
            queryBuilder.where('user.role = :role', { role });
        }

        const [users, total] = await queryBuilder.getManyAndCount();

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async updateUserRole(userId: string, role: UserRole) {
        return this.userRepository.update(userId, { role });
    }

    async updateUserStatus(userId: string, isActive: boolean) {
        return this.userRepository.update(userId, { is_active: isActive });
    }
}
