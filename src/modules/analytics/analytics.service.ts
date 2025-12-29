import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Order, PaymentStatus } from '../../entities/order.entity';
import { Ticket, TicketType, TicketStatus } from '../../entities/ticket.entity';
import { User } from '../../entities/user.entity';
import { Event, EventStatus } from '../../entities/event.entity';
import { LotteryEntry } from '../../entities/lottery-entry.entity';
import { Waitlist } from '../../entities/waitlist.entity';
import { PromoCodeUsage } from '../../entities/promo-code-usage.entity';

export interface TimeSeriesPoint {
    date: string;
    value: number;
}

export interface ActivityItem {
    type: string;
    description: string;
    timestamp: Date;
    metadata?: any;
}

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(Ticket)
        private ticketRepository: Repository<Ticket>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
        @InjectRepository(LotteryEntry)
        private lotteryRepository: Repository<LotteryEntry>,
        @InjectRepository(Waitlist)
        private waitlistRepository: Repository<Waitlist>,
        @InjectRepository(PromoCodeUsage)
        private promoUsageRepository: Repository<PromoCodeUsage>,
    ) { }

    /**
     * Get ticket sales over time (daily breakdown)
     */
    async getSalesTimeSeries(days: number = 30, eventId?: string): Promise<TimeSeriesPoint[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const query = this.orderRepository
            .createQueryBuilder('order')
            .select("DATE(order.created_at)", 'date')
            .addSelect('COUNT(*)', 'count')
            .addSelect('SUM(order.total_amount)', 'revenue')
            .where('order.payment_status = :status', { status: PaymentStatus.PAID })
            .andWhere('order.created_at >= :startDate', { startDate })
            .andWhere('order.created_at <= :endDate', { endDate });

        if (eventId) {
            query.andWhere('order.event_id = :eventId', { eventId });
        }

        query.groupBy("DATE(order.created_at)").orderBy('date', 'ASC');

        const results = await query.getRawMany();

        // Fill in missing dates with 0
        const salesMap = new Map(results.map(r => [r.date.toISOString().split('T')[0], {
            count: parseInt(r.count) || 0,
            revenue: parseFloat(r.revenue) || 0,
        }]));

        const timeSeries: any[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const data = salesMap.get(dateStr) || { count: 0, revenue: 0 };
            timeSeries.push({
                date: dateStr,
                orders: data.count,
                revenue: data.revenue,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return timeSeries;
    }

    /**
     * Get check-in times distribution (for staffing decisions)
     */
    async getCheckInDistribution(eventId?: string): Promise<any[]> {
        const query = this.ticketRepository
            .createQueryBuilder('ticket')
            .select("EXTRACT(HOUR FROM ticket.checked_in_at)", 'hour')
            .addSelect('COUNT(*)', 'count')
            .where('ticket.status = :status', { status: TicketStatus.REDEEMED })
            .andWhere('ticket.checked_in_at IS NOT NULL');

        if (eventId) {
            query.andWhere('ticket.event_id = :eventId', { eventId });
        }

        query.groupBy("EXTRACT(HOUR FROM ticket.checked_in_at)").orderBy('hour', 'ASC');

        const results = await query.getRawMany();

        // Fill in all 24 hours
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${i.toString().padStart(2, '0')}:00`,
            count: 0,
        }));

        results.forEach(r => {
            const hour = parseInt(r.hour);
            if (hour >= 0 && hour < 24) {
                hourlyData[hour].count = parseInt(r.count) || 0;
            }
        });

        return hourlyData;
    }

    /**
     * Get customer retention metrics
     */
    async getCustomerRetention(): Promise<any> {
        // Users who have attended multiple events
        const repeatCustomers = await this.orderRepository
            .createQueryBuilder('order')
            .select('order.user_id', 'userId')
            .addSelect('COUNT(DISTINCT order.event_id)', 'eventCount')
            .where('order.payment_status = :status', { status: PaymentStatus.PAID })
            .groupBy('order.user_id')
            .having('COUNT(DISTINCT order.event_id) > 1')
            .getRawMany();

        // Total unique customers
        const totalCustomers = await this.orderRepository
            .createQueryBuilder('order')
            .select('COUNT(DISTINCT order.user_id)', 'count')
            .where('order.payment_status = :status', { status: PaymentStatus.PAID })
            .getRawOne();

        const repeatCount = repeatCustomers.length;
        const totalCount = parseInt(totalCustomers.count) || 0;
        const retentionRate = totalCount > 0 ? Math.round((repeatCount / totalCount) * 100) : 0;

        // Distribution of events attended
        const distribution = {
            '1 event': 0,
            '2 events': 0,
            '3 events': 0,
            '4+ events': 0,
        };

        // Get all customer event counts
        const allCustomerCounts = await this.orderRepository
            .createQueryBuilder('order')
            .select('order.user_id', 'userId')
            .addSelect('COUNT(DISTINCT order.event_id)', 'eventCount')
            .where('order.payment_status = :status', { status: PaymentStatus.PAID })
            .groupBy('order.user_id')
            .getRawMany();

        allCustomerCounts.forEach(c => {
            const count = parseInt(c.eventCount);
            if (count === 1) distribution['1 event']++;
            else if (count === 2) distribution['2 events']++;
            else if (count === 3) distribution['3 events']++;
            else if (count >= 4) distribution['4+ events']++;
        });

        return {
            totalCustomers: totalCount,
            repeatCustomers: repeatCount,
            retentionRate: `${retentionRate}%`,
            distribution,
        };
    }

    /**
     * Get activity breakdown by type
     */
    async getActivityBreakdown(): Promise<any> {
        const [
            standardTickets,
            adoptedTickets,
            checkedIn,
            lotteryEntries,
            lotteryWinners,
            waitlistEntries,
            promoUsages,
            transfers,
        ] = await Promise.all([
            // Standard tickets
            this.ticketRepository.count({ where: { type: TicketType.STANDARD } }),

            // Adopted tickets
            this.ticketRepository.count({ where: { type: TicketType.ADOPTED } }),

            // Checked in
            this.ticketRepository.count({ where: { status: TicketStatus.REDEEMED } }),

            // Lottery entries
            this.lotteryRepository.count(),

            // Lottery winners
            this.lotteryRepository.count({ where: { is_winner: true } }),

            // Waitlist entries
            this.waitlistRepository.count(),

            // Promo code usages
            this.promoUsageRepository.count(),

            // Transfers (tickets where holder_id != purchaser_id)
            this.ticketRepository
                .createQueryBuilder('ticket')
                .where('ticket.holder_id IS NOT NULL')
                .andWhere('ticket.holder_id != ticket.purchaser_id')
                .getCount(),
        ]);

        return {
            tickets: {
                standard: standardTickets,
                adopted: adoptedTickets,
                checkedIn,
                transfers,
            },
            lottery: {
                entries: lotteryEntries,
                winners: lotteryWinners,
                winRate: lotteryEntries > 0 ? Math.round((lotteryWinners / lotteryEntries) * 100) : 0,
            },
            engagement: {
                waitlist: waitlistEntries,
                promoUsages,
            },
        };
    }

    /**
     * Get recent activity feed
     */
    async getActivityFeed(limit: number = 50): Promise<ActivityItem[]> {
        const activities: ActivityItem[] = [];

        // Get recent orders
        const recentOrders = await this.orderRepository.find({
            where: { payment_status: PaymentStatus.PAID },
            relations: ['user', 'event'],
            order: { created_at: 'DESC' },
            take: 15,
        });

        recentOrders.forEach(order => {
            activities.push({
                type: 'purchase',
                description: `${order.user?.first_name || 'User'} purchased tickets for ${order.event?.title || 'event'}`,
                timestamp: order.created_at,
                metadata: { orderId: order.id, amount: order.total_amount },
            });
        });

        // Get recent check-ins
        const recentCheckIns = await this.ticketRepository.find({
            where: { status: TicketStatus.REDEEMED },
            relations: ['holder', 'event'],
            order: { checked_in_at: 'DESC' },
            take: 15,
        });

        recentCheckIns.forEach(ticket => {
            if (ticket.checked_in_at) {
                activities.push({
                    type: 'checkin',
                    description: `${ticket.holder?.first_name || 'Guest'} checked in at ${ticket.checked_in_gate || 'gate'}`,
                    timestamp: ticket.checked_in_at,
                    metadata: { ticketId: ticket.id, gate: ticket.checked_in_gate },
                });
            }
        });

        // Get recent lottery wins
        const recentWinners = await this.lotteryRepository.find({
            where: { is_winner: true },
            relations: ['user', 'event'],
            order: { created_at: 'DESC' },
            take: 10,
        });

        recentWinners.forEach(entry => {
            activities.push({
                type: 'lottery_win',
                description: `${entry.user?.first_name || 'User'} won lottery for ${entry.event?.title || 'event'}`,
                timestamp: entry.created_at,
                metadata: { entryId: entry.id },
            });
        });

        // Get recent waitlist signups
        const recentWaitlist = await this.waitlistRepository.find({
            relations: ['event', 'tier'],
            order: { created_at: 'DESC' },
            take: 10,
        });

        recentWaitlist.forEach(wl => {
            activities.push({
                type: 'waitlist',
                description: `${wl.email} joined waitlist for ${wl.tier?.name || 'tier'}`,
                timestamp: wl.created_at,
                metadata: { email: wl.email },
            });
        });

        // Sort by timestamp and limit
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return activities.slice(0, limit);
    }

    /**
     * Get revenue breakdown by event
     */
    async getRevenueByEvent(): Promise<any[]> {
        const results = await this.orderRepository
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.event', 'event')
            .select('order.event_id', 'eventId')
            .addSelect('event.title', 'eventTitle')
            .addSelect('SUM(order.total_amount)', 'revenue')
            .addSelect('COUNT(*)', 'orderCount')
            .where('order.payment_status = :status', { status: PaymentStatus.PAID })
            .groupBy('order.event_id')
            .addGroupBy('event.title')
            .orderBy('revenue', 'DESC')
            .limit(10)
            .getRawMany();

        return results.map(r => ({
            eventId: r.eventId,
            eventTitle: r.eventTitle || 'Unknown Event',
            revenue: parseFloat(r.revenue) || 0,
            orderCount: parseInt(r.orderCount) || 0,
        }));
    }

    /**
     * Get gate performance stats
     */
    async getGatePerformance(eventId?: string): Promise<any[]> {
        const query = this.ticketRepository
            .createQueryBuilder('ticket')
            .select('ticket.checked_in_gate', 'gate')
            .addSelect('COUNT(*)', 'count')
            .where('ticket.status = :status', { status: TicketStatus.REDEEMED })
            .andWhere('ticket.checked_in_gate IS NOT NULL');

        if (eventId) {
            query.andWhere('ticket.event_id = :eventId', { eventId });
        }

        query.groupBy('ticket.checked_in_gate').orderBy('count', 'DESC');

        const results = await query.getRawMany();

        const total = results.reduce((sum, r) => sum + parseInt(r.count), 0);

        return results.map(r => ({
            gate: r.gate,
            count: parseInt(r.count) || 0,
            percentage: total > 0 ? Math.round((parseInt(r.count) / total) * 100) : 0,
        }));
    }

    /**
     * Get ticket type breakdown over time
     */
    async getTicketTypeTrend(days: number = 30): Promise<any[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const results = await this.ticketRepository
            .createQueryBuilder('ticket')
            .select("DATE(ticket.created_at)", 'date')
            .addSelect('ticket.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('ticket.created_at >= :startDate', { startDate })
            .andWhere('ticket.created_at <= :endDate', { endDate })
            .groupBy("DATE(ticket.created_at)")
            .addGroupBy('ticket.type')
            .orderBy('date', 'ASC')
            .getRawMany();

        // Organize by date
        const dateMap = new Map<string, { standard: number; adopted: number }>();

        results.forEach(r => {
            const dateStr = r.date.toISOString().split('T')[0];
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { standard: 0, adopted: 0 });
            }
            const entry = dateMap.get(dateStr)!;
            if (r.type === TicketType.STANDARD) {
                entry.standard = parseInt(r.count) || 0;
            } else if (r.type === TicketType.ADOPTED) {
                entry.adopted = parseInt(r.count) || 0;
            }
        });

        // Fill missing dates
        const trend: any[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const data = dateMap.get(dateStr) || { standard: 0, adopted: 0 };
            trend.push({
                date: dateStr,
                standard: data.standard,
                adopted: data.adopted,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return trend;
    }

    /**
     * Get comprehensive dashboard data
     */
    async getFullDashboard(days: number = 30, eventId?: string) {
        const [
            salesTimeSeries,
            checkInDistribution,
            customerRetention,
            activityBreakdown,
            activityFeed,
            revenueByEvent,
            gatePerformance,
            ticketTypeTrend,
        ] = await Promise.all([
            this.getSalesTimeSeries(days, eventId),
            this.getCheckInDistribution(eventId),
            this.getCustomerRetention(),
            this.getActivityBreakdown(),
            this.getActivityFeed(30),
            this.getRevenueByEvent(),
            this.getGatePerformance(eventId),
            this.getTicketTypeTrend(days),
        ]);

        return {
            salesTimeSeries,
            checkInDistribution,
            customerRetention,
            activityBreakdown,
            activityFeed,
            revenueByEvent,
            gatePerformance,
            ticketTypeTrend,
        };
    }
}
