import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from '../../entities/waitlist.entity';
import { TicketTier } from '../../entities/ticket-tier.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Injectable()
export class WaitlistService {
    constructor(
        @InjectRepository(Waitlist)
        private waitlistRepository: Repository<Waitlist>,
        @InjectRepository(TicketTier)
        private tierRepository: Repository<TicketTier>,
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

        return this.waitlistRepository.save(waitlistEntry);
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
}
