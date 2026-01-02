import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../../entities/event.entity';
import { TicketTier, TierCategory } from '../../entities/ticket-tier.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(TicketTier)
    private tierRepository: Repository<TicketTier>,
  ) { }

  async create(createEventDto: CreateEventDto, user?: any): Promise<Event> {
    const event = this.eventsRepository.create({
      ...createEventDto,
      user_id: user?.userId,
    });
    return this.eventsRepository.save(event);
  }

  async findAll(page: number = 1, limit: number = 20, status?: EventStatus): Promise<PaginatedResult<Event>> {
    const query = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.ticket_tiers', 'tiers')
      .orderBy('event.start_date', 'ASC');

    if (status) {
      query.where('event.status = :status', { status });
    }

    const total = await query.getCount();
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const events = await query.getMany();
    this.logger.log(`findAll(page=${page}, limit=${limit}, status=${status || 'all'}): Found ${events.length} of ${total} events`);
    return createPaginatedResult(events, total, page, limit);
  }

  async findByUser(userId: string): Promise<Event[]> {
    this.logger.debug(`Finding events for user: ${userId}`);
    const query = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.ticket_tiers', 'tiers')
      .where('event.user_id = :userId', { userId })
      .orderBy('event.start_date', 'ASC');

    const events = await query.getMany();
    this.logger.log(`findByUser(${userId}): Found ${events.length} events`);
    return events;
  }

  async findPublished(page: number = 1, limit: number = 20): Promise<PaginatedResult<Event>> {
    const result = await this.findAll(page, limit, EventStatus.PUBLISHED);
    this.logger.log(`findPublished: Found ${result.data.length} of ${result.meta.total} published events`);
    return result;
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ticket_tiers', 'products'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    await this.eventsRepository.update(id, updateEventDto);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.eventsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Event not found');
    }
  }

  // Ticket Tier Management
  async createTier(eventId: string, createTierDto: CreateTierDto): Promise<TicketTier> {
    const event = await this.findById(eventId);

    // Validate sales window
    if (createTierDto.sales_start && createTierDto.sales_end) {
      if (new Date(createTierDto.sales_start) >= new Date(createTierDto.sales_end)) {
        throw new BadRequestException('Sales start date must be before sales end date');
      }
    }

    const tier = this.tierRepository.create({
      ...createTierDto,
      event_id: eventId,
      remaining_quantity: createTierDto.initial_quantity,
    });

    return this.tierRepository.save(tier);
  }

  async getTiersByEvent(eventId: string): Promise<TicketTier[]> {
    return this.tierRepository.find({
      where: { event_id: eventId, is_active: true },
      order: { created_at: 'ASC' },
    });
  }

  async getTiersGroupedByCategory(eventId: string): Promise<Record<string, TicketTier[]>> {
    const tiers = await this.getTiersByEvent(eventId);

    // Group by category
    const grouped: Record<string, TicketTier[]> = {};
    tiers.forEach((tier) => {
      if (!grouped[tier.category]) {
        grouped[tier.category] = [];
      }
      grouped[tier.category].push(tier);
    });

    return grouped;
  }

  async getTierById(tierId: string): Promise<TicketTier> {
    const tier = await this.tierRepository.findOne({
      where: { id: tierId },
    });

    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }

    return tier;
  }

  async updateTier(tierId: string, updateTierDto: UpdateTierDto): Promise<TicketTier> {
    const existingTier = await this.getTierById(tierId);

    // Create update object
    const updateData: Partial<TicketTier> = { ...updateTierDto } as unknown as Partial<TicketTier>;

    // Handle Dates
    if (updateTierDto.sales_start) {
      updateData.sales_start = new Date(updateTierDto.sales_start);
    }
    if (updateTierDto.sales_end) {
      updateData.sales_end = new Date(updateTierDto.sales_end);
    }

    // Handle Quantity Update
    if (updateTierDto.initial_quantity !== undefined && updateTierDto.initial_quantity !== existingTier.initial_quantity) {
      const soldCount = existingTier.initial_quantity - existingTier.remaining_quantity;

      if (updateTierDto.initial_quantity < soldCount) {
        throw new BadRequestException(
          `Cannot reduce quantity to ${updateTierDto.initial_quantity}. ${soldCount} tickets already sold/reserved.`
        );
      }

      // Adjust remaining quantity based on the new initial quantity
      // newRemaining = newInitial - sold
      updateData.remaining_quantity = updateTierDto.initial_quantity - soldCount;
    }

    await this.tierRepository.update(tierId, updateData);
    return this.getTierById(tierId);
  }

  async isTierAvailable(tierId: string): Promise<boolean> {
    const tier = await this.getTierById(tierId);
    const now = new Date();

    // Check if tier is active
    if (!tier.is_active) return false;

    // Check remaining quantity
    if (tier.remaining_quantity <= 0) return false;

    // Check sales window
    if (tier.sales_start && now < new Date(tier.sales_start)) return false;
    if (tier.sales_end && now > new Date(tier.sales_end)) return false;

    return true;
  }

  async deleteTier(tierId: string): Promise<void> {
    const tier = await this.getTierById(tierId);
    tier.is_active = false;
    await this.tierRepository.save(tier);
  }

  async updateEventImage(eventId: string, imageUrl: string): Promise<Event> {
    const event = await this.findById(eventId);
    event.banner_image_url = imageUrl;
    return this.eventsRepository.save(event);
  }

  // Admin-only methods
  async findAllForAdmin(page: number = 1, limit: number = 20): Promise<PaginatedResult<Event>> {
    const query = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.ticket_tiers', 'tiers')
      .leftJoinAndSelect('event.user', 'user')
      .orderBy('event.created_at', 'DESC');

    const total = await query.getCount();
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const events = await query.getMany();
    return createPaginatedResult(events, total, page, limit);
  }

  async updateStatus(
    id: string,
    status: EventStatus,
    isAdmin: boolean,
  ): Promise<Event> {
    const event = await this.findById(id);

    // Only admins can set ARCHIVED status
    if (status === EventStatus.ARCHIVED && !isAdmin) {
      throw new BadRequestException('Only admins can archive events');
    }

    // Only admins can change from ARCHIVED status
    if (event.status === EventStatus.ARCHIVED && !isAdmin) {
      throw new BadRequestException('Only admins can modify archived events');
    }

    event.status = status;
    return this.eventsRepository.save(event);
  }

  async deleteByAdmin(id: string): Promise<void> {
    const result = await this.eventsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Event not found');
    }
  }
}
