import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import * as admin from 'firebase-admin';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
    private logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Ticket)
        private ticketRepository: Repository<Ticket>,
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
    ) {
        if (admin.apps.length === 0) {
            try {
                // Should use GOOGLE_APPLICATION_CREDENTIALS env var
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
            } catch (err) {
                this.logger.warn('Firebase init failed (Notifications will allow mock execution): ' + err.message);
            }
        }
    }

    async registerDevice(userId: string, token: string) {
        await this.userRepository.update(userId, { fcm_token: token });
        return { success: true };
    }

    async sendToUser(userId: string, title: string, body: string, data?: any) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user || (!user.fcm_token && !process.env.MOCK_NOTIFICATIONS)) {
            this.logger.debug(`Skipping notification for ${userId}: No token`);
            return;
        }

        try {
            if (process.env.MOCK_NOTIFICATIONS === 'true') {
                this.logger.log(`[MOCK] Sent notification to ${user.email}: ${title} - ${body}`);
                return;
            }

            if (user.fcm_token) {
                await admin.messaging().send({
                    token: user.fcm_token,
                    notification: { title, body },
                    data: data ? this.formatData(data) : {},
                });
                this.logger.log(`Notification sent to ${user.email}`);
            }
        } catch (error) {
            this.logger.error(`Failed to send notification to user ${userId}`, error);
        }
    }

    private formatData(data: any) {
        const formatted: any = {};
        for (const key in data) {
            if (data[key] !== undefined && data[key] !== null) {
                formatted[key] = String(data[key]);
            }
        }
        return formatted;
    }

    @Cron(CronExpression.EVERY_HOUR)
    async checkUpcomingEvents() {
        this.logger.log('Checking for upcoming event reminders...');

        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1h = new Date(now.getTime() + 60 * 60 * 1000);

        // Simple window check (e.g. events starting in next hour)
        // For production, use 'Between' with tight buffer or a 'reminder_sent' flag on event/ticket

        // 1. Check for 24h reminders
        const events24h = await this.eventRepository.find({
            where: {
                start_date: Between(
                    new Date(in24h.getTime() - 30 * 60000), // -30 mins
                    new Date(in24h.getTime() + 30 * 60000)  // +30 mins
                )
            }
        });

        for (const event of events24h) {
            await this.sendEventReminder(event, '24 hours');
        }

        // 2. Check for 1h reminders
        const events1h = await this.eventRepository.find({
            where: {
                start_date: Between(
                    new Date(in1h.getTime() - 30 * 60000),
                    new Date(in1h.getTime() + 30 * 60000)
                )
            }
        });

        for (const event of events1h) {
            await this.sendEventReminder(event, '1 hour');
        }
    }

    private async sendEventReminder(event: Event, timeString: string) {
        const tickets = await this.ticketRepository.find({
            where: { event_id: event.id, status: TicketStatus.ISSUED },
            relations: ['holder']
        });

        this.logger.log(`Sending ${timeString} reminder for event ${event.title} to ${tickets.length} attendees.`);

        for (const ticket of tickets) {
            if (ticket.holder && ticket.holder.fcm_token) {
                await this.sendToUser(
                    ticket.holder.id,
                    `Event Reminder: ${event.title}`,
                    `Your event starts in ${timeString}! Check details in the app.`,
                    { type: 'EVENT_REMINDER', eventId: event.id }
                );
            }
        }
    }
}
