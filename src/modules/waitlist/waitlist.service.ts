import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from '../../entities/waitlist.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { Event } from '../../entities/event.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WaitlistService {
    constructor(
        @InjectRepository(Waitlist)
        private waitlistRepository: Repository<Waitlist>,
        @InjectRepository(TicketTier)
        private tierRepository: Repository<TicketTier>,
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
        private emailService: EmailService,
        private notificationsService: NotificationsService,
    ) { }

    async join(dto: JoinWaitlistDto, userId?: string): Promise<Waitlist> {
        const tier = await this.tierRepository.findOne({ where: { id: dto.tierId } });
        if (!tier) throw new NotFoundException('Ticket tier not found');

        // Check if already in waitlist
        const existing = await this.waitlistRepository.findOne({
            where: {
                email: dto.email,
                tier_id: dto.tierId,
            },
        });

        if (existing) {
            throw new ConflictException('Email already in waitlist for this tier');
        }

        const waitlistEntry = this.waitlistRepository.create({
            event_id: dto.eventId,
            tier_id: dto.tierId,
            email: dto.email,
            phone_number: dto.phoneNumber,
            user_id: userId,
        });

        const savedEntry = await this.waitlistRepository.save(waitlistEntry);

        // Send waitlist confirmation email
        const event = await this.eventRepository.findOne({ where: { id: dto.eventId } });
        this.emailService.sendWaitlistJoined({
            customerName: dto.email.split('@')[0],
            customerEmail: dto.email,
            eventTitle: event?.title || 'Event',
            tierName: tier.name,
        }).catch(err => console.error('Failed to send waitlist confirmation email:', err));

        return savedEntry;
    }

    async getStatsByEvent(eventId: string) {
        const stats = await this.waitlistRepository
            .createQueryBuilder('waitlist')
            .select('waitlist.tier_id', 'tierId')
            .addSelect('COUNT(waitlist.id)', 'count')
            .where('waitlist.event_id = :eventId', { eventId })
            .groupBy('waitlist.tier_id')
            .getRawMany();

        return stats;
    }

    /**
     * Notify waitlist users when tickets become available
     */
    async notifyWaitlist(eventId: string, tierId: string): Promise<number> {
        const entries = await this.waitlistRepository.find({
            where: { event_id: eventId, tier_id: tierId, notified: false },
        });

        if (entries.length === 0) return 0;

        const event = await this.eventRepository.findOne({ where: { id: eventId } });
        const tier = await this.tierRepository.findOne({ where: { id: tierId } });

        if (!event || !tier) return 0;

        let notifiedCount = 0;

        for (const entry of entries) {
            const sent = await this.emailService.sendWaitlistNotification({
                customerName: entry.email.split('@')[0],
                customerEmail: entry.email,
                eventTitle: event.title,
                tierName: tier.name,
                purchaseUrl: `https://tickets.vitaldigitalmedia.net/events/${eventId}`,
            });

            if (sent) {
                entry.notified = true;
                await this.waitlistRepository.save(entry);
                notifiedCount++;
            }

            if (entry.user_id) {
                this.notificationsService.sendToUser(
                    entry.user_id,
                    `Tickets Available! 🎟️`,
                    `Tickets for ${tier.name} are now available! grab yours before they run out.`,
                    { type: 'WAITLIST_ALERT', eventId: eventId, tierId: tierId }
                ).catch(err => console.error('Push failed', err));
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return notifiedCount;
    }

    async notifyPriceDrop(tier: TicketTier, oldPrice: number, newPrice: number) {
        const entries = await this.waitlistRepository.find({
            where: { tier_id: tier.id },
        });

        for (const entry of entries) {
            if (entry.user_id) {
                this.notificationsService.sendToUser(
                    entry.user_id,
                    'Price Drop Alert! 📉',
                    `Good news! The price for ${tier.name} has dropped to KES ${newPrice}. Book now!`,
                    { type: 'PRICE_DROP', tierId: tier.id, eventId: tier.event?.id || '' }
                ).catch(err => console.error('Push failed', err));
            }
        }
    }
}
