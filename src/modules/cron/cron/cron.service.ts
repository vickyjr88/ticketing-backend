import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Order, PaymentStatus } from '../../../entities/order.entity';
import { Ticket, TicketStatus } from '../../../entities/ticket.entity';
import { TicketTier } from '../../../entities/ticket-tier.entity';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(Ticket)
        private ticketRepository: Repository<Ticket>,
        @InjectRepository(TicketTier)
        private tierRepository: Repository<TicketTier>,
    ) { }

    /**
     * Check for pending orders older than 15 minutes and cancel them
     * This releases the held inventory back to the pool
     */
    @Cron(CronExpression.EVERY_30_MINUTES)
    async checkPendingOrders() {
        this.logger.debug('Checking for expired pending orders...');

        // 15 minutes ago
        const expirationTime = new Date(Date.now() - 15 * 60 * 1000);

        // Find expired orders
        const expiredOrders = await this.orderRepository.find({
            where: {
                payment_status: PaymentStatus.PENDING,
                created_at: LessThan(expirationTime),
            },
            relations: ['tickets', 'tickets.tier'],
        });

        if (expiredOrders.length === 0) {
            return;
        }

        this.logger.log(`Found ${expiredOrders.length} expired orders. Processing cancellations...`);

        for (const order of expiredOrders) {
            try {
                await this.processExpiredOrder(order);
            } catch (error) {
                this.logger.error(`Failed to cancel expired order ${order.id}:`, error);
            }
        }
    }

    private async processExpiredOrder(order: Order) {
        if (order.payment_status !== PaymentStatus.PENDING) return;

        // 1. Group tickets by tier to restore inventory efficiently
        const tierCounts = new Map<string, number>();

        for (const ticket of order.tickets) {
            if (ticket.status === TicketStatus.PENDING) {
                const currentCount = tierCounts.get(ticket.tier_id) || 0;
                tierCounts.set(ticket.tier_id, currentCount + 1);
            }
        }

        // 2. Mark order as FAILED (Expired)
        order.payment_status = PaymentStatus.FAILED;
        order.payment_metadata = { ...order.payment_metadata, failure_reason: 'Payment timeout (15 mins)' };
        await this.orderRepository.save(order);

        // 3. Cancel tickets
        if (order.tickets.length > 0) {
            await this.ticketRepository.update(
                { order_id: order.id },
                { status: TicketStatus.CANCELLED }
            );
        }

        // 4. Restore inventory
        for (const [tierId, count] of tierCounts.entries()) {
            // Calculate original quantity (since multiple tickets per unit)
            // We need to fetch the tier to know tickets_per_unit, or assume 1 if not available
            // Ideally ticket entity should store unit_quantity but for now we iterate to update inventory

            const tier = await this.tierRepository.findOne({ where: { id: tierId } });
            if (tier) {
                // Determine how many *purchasable units* this represents
                // count = total individual tickets
                // units = count / tickets_per_unit
                const unitsRestored = Math.ceil(count / tier.tickets_per_unit);

                await this.tierRepository.increment(
                    { id: tierId },
                    'remaining_quantity',
                    unitsRestored
                );

                this.logger.log(`Restored ${unitsRestored} units to tier ${tier.name} (ID: ${tierId})`);
            }
        }

        this.logger.log(`Cancelled expired order ${order.id}`);
    }
}
