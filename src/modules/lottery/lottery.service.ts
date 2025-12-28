import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LotteryEntry } from '../../entities/lottery-entry.entity';
import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';

@Injectable()
export class LotteryService {
  constructor(
    @InjectRepository(LotteryEntry)
    private lotteryRepository: Repository<LotteryEntry>,
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    private dataSource: DataSource,
  ) {}

  /**
   * Enter lottery for an event
   */
  async enterLottery(userId: string, eventId: string): Promise<LotteryEntry> {
    // Verify event exists and has lottery enabled
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (!event.lottery_enabled) {
      throw new BadRequestException('Lottery is not enabled for this event');
    }

    // Check if already entered
    const existingEntry = await this.lotteryRepository.findOne({
      where: { event_id: eventId, user_id: userId },
    });

    if (existingEntry) {
      throw new ConflictException('You have already entered this lottery');
    }

    // Create entry
    const entry = this.lotteryRepository.create({
      event_id: eventId,
      user_id: userId,
    });

    return this.lotteryRepository.save(entry);
  }

  /**
   * The Lottery Engine - Randomly assigns tickets from pool to entrants
   */
  async runLotteryDraw(eventId: string): Promise<{
    totalTickets: number;
    totalEntrants: number;
    winners: number;
  }> {
    return await this.dataSource.transaction(async (manager) => {
      // Lock pool tickets (SELECT FOR UPDATE)
      const poolTickets = await manager
        .createQueryBuilder(Ticket, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.event_id = :eventId', { eventId })
        .andWhere('ticket.status = :status', { status: TicketStatus.POOL })
        .getMany();

      if (poolTickets.length === 0) {
        throw new BadRequestException('No tickets available in the pool');
      }

      // Lock lottery entries
      const entries = await manager
        .createQueryBuilder(LotteryEntry, 'entry')
        .setLock('pessimistic_write')
        .where('entry.event_id = :eventId', { eventId })
        .andWhere('entry.is_winner = false')
        .getMany();

      if (entries.length === 0) {
        throw new BadRequestException('No lottery entries found');
      }

      // Shuffle entrants using Fisher-Yates algorithm
      const shuffledEntries = this.shuffleArray([...entries]);

      // Assign tickets to winners
      let winnersCount = 0;
      const assignmentsCount = Math.min(poolTickets.length, shuffledEntries.length);

      for (let i = 0; i < assignmentsCount; i++) {
        const ticket = poolTickets[i];
        const winner = shuffledEntries[i];

        // Update ticket
        ticket.holder_id = winner.user_id;
        ticket.status = TicketStatus.WON;
        await manager.save(Ticket, ticket);

        // Update lottery entry
        winner.is_winner = true;
        winner.won_at = new Date();
        await manager.save(LotteryEntry, winner);

        winnersCount++;
      }

      // Update event lottery draw date
      await manager.update(Event, eventId, {
        lottery_draw_date: new Date(),
      });

      return {
        totalTickets: poolTickets.length,
        totalEntrants: entries.length,
        winners: winnersCount,
      };
    });
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get lottery entries for an event
   */
  async getEntriesByEvent(eventId: string): Promise<LotteryEntry[]> {
    return this.lotteryRepository.find({
      where: { event_id: eventId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get winners for an event
   */
  async getWinnersByEvent(eventId: string): Promise<LotteryEntry[]> {
    return this.lotteryRepository.find({
      where: { event_id: eventId, is_winner: true },
      relations: ['user'],
      order: { won_at: 'DESC' },
    });
  }

  /**
   * Get user's lottery entries
   */
  async getUserEntries(userId: string): Promise<LotteryEntry[]> {
    return this.lotteryRepository.find({
      where: { user_id: userId },
      relations: ['event'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Check if user is eligible to enter lottery
   */
  async isEligible(userId: string, eventId: string): Promise<boolean> {
    const entry = await this.lotteryRepository.findOne({
      where: { event_id: eventId, user_id: userId },
    });
    return !entry;
  }

  /**
   * Get lottery statistics for an event
   */
  async getStats(eventId: string): Promise<{
    totalEntries: number;
    totalWinners: number;
    availableTickets: number;
  }> {
    const [totalEntries, totalWinners, availableTickets] = await Promise.all([
      this.lotteryRepository.count({ where: { event_id: eventId } }),
      this.lotteryRepository.count({
        where: { event_id: eventId, is_winner: true },
      }),
      this.ticketsRepository.count({
        where: { event_id: eventId, status: TicketStatus.POOL },
      }),
    ]);

    return {
      totalEntries,
      totalWinners,
      availableTickets,
    };
  }
}
