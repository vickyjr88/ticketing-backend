import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromoCode, DiscountType } from '../../entities/promo-code.entity';
import { PromoCodeUsage } from '../../entities/promo-code-usage.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';

export interface PromoValidationResult {
    valid: boolean;
    promo_code?: PromoCode;
    discount_amount?: number;
    error?: string;
}

@Injectable()
export class PromoService {
    constructor(
        @InjectRepository(PromoCode)
        private promoCodeRepository: Repository<PromoCode>,
        @InjectRepository(PromoCodeUsage)
        private promoUsageRepository: Repository<PromoCodeUsage>,
    ) { }

    /**
     * Create a new promo code
     */
    async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
        // Normalize code to uppercase
        const code = dto.code.toUpperCase().trim();

        // Check for duplicate
        const existing = await this.promoCodeRepository.findOne({
            where: { code },
        });
        if (existing) {
            throw new ConflictException(`Promo code "${code}" already exists`);
        }

        const promoCode = this.promoCodeRepository.create({
            ...dto,
            code,
            valid_from: dto.valid_from ? new Date(dto.valid_from) : null,
            valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        });

        return this.promoCodeRepository.save(promoCode);
    }

    /**
     * Get all promo codes with pagination
     */
    async findAll(page: number = 1, limit: number = 20, includeInactive = false): Promise<PaginatedResult<PromoCode>> {
        const query = this.promoCodeRepository
            .createQueryBuilder('promo')
            .leftJoinAndSelect('promo.event', 'event')
            .orderBy('promo.created_at', 'DESC');

        if (!includeInactive) {
            query.where('promo.is_active = :active', { active: true });
        }

        const total = await query.getCount();
        query.skip((page - 1) * limit).take(limit);
        const data = await query.getMany();
        return createPaginatedResult(data, total, page, limit);
    }

    /**
     * Get a single promo code by ID
     */
    async findById(id: string): Promise<PromoCode> {
        const promo = await this.promoCodeRepository.findOne({
            where: { id },
            relations: ['event'],
        });
        if (!promo) {
            throw new NotFoundException('Promo code not found');
        }
        return promo;
    }

    /**
     * Update a promo code
     */
    async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCode> {
        const promo = await this.findById(id);

        if (dto.code) {
            const code = dto.code.toUpperCase().trim();
            const existing = await this.promoCodeRepository.findOne({
                where: { code },
            });
            if (existing && existing.id !== id) {
                throw new ConflictException(`Promo code "${code}" already exists`);
            }
            dto.code = code;
        }

        Object.assign(promo, {
            ...dto,
            valid_from: dto.valid_from ? new Date(dto.valid_from) : promo.valid_from,
            valid_until: dto.valid_until ? new Date(dto.valid_until) : promo.valid_until,
        });

        return this.promoCodeRepository.save(promo);
    }

    /**
     * Delete a promo code
     */
    async delete(id: string): Promise<void> {
        const promo = await this.findById(id);
        await this.promoCodeRepository.remove(promo);
    }

    /**
     * Validate a promo code for a user and calculate discount
     */
    async validatePromoCode(
        code: string,
        userId: string,
        eventId: string,
        subtotal: number,
        productIds: string[] = [],
    ): Promise<PromoValidationResult> {
        const normalizedCode = code.toUpperCase().trim();

        // Find the promo code
        const promo = await this.promoCodeRepository.findOne({
            where: { code: normalizedCode },
        });

        if (!promo) {
            return { valid: false, error: 'Promo code not found' };
        }

        // Check if active
        if (!promo.is_active) {
            return { valid: false, error: 'This promo code is no longer active' };
        }

        // Check validity dates
        const now = new Date();
        if (promo.valid_from && now < promo.valid_from) {
            return { valid: false, error: 'This promo code is not yet valid' };
        }
        if (promo.valid_until && now > promo.valid_until) {
            return { valid: false, error: 'This promo code has expired' };
        }

        // Check event restriction
        if (promo.event_id && promo.event_id !== eventId) {
            return { valid: false, error: 'This promo code is not valid for this event' };
        }

        // Check product restriction
        if (promo.product_ids && promo.product_ids.length > 0) {
            const hasEligibleProduct = productIds.some(id => promo.product_ids.includes(id));
            if (!hasEligibleProduct) {
                return { valid: false, error: 'This promo code requires specific products in your cart' };
            }
        }

        // Check usage limit
        if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
            return { valid: false, error: 'This promo code has reached its usage limit' };
        }

        // Check per-user limit
        if (promo.per_user_limit) {
            const userUsageCount = await this.promoUsageRepository.count({
                where: { promo_code_id: promo.id, user_id: userId },
            });
            if (userUsageCount >= promo.per_user_limit) {
                return { valid: false, error: 'You have already used this promo code' };
            }
        }

        // Check minimum order amount
        if (promo.min_order_amount && subtotal < promo.min_order_amount) {
            return {
                valid: false,
                error: `Minimum order amount of KES ${promo.min_order_amount} required`,
            };
        }

        // Calculate discount
        let discountAmount: number;
        if (promo.discount_type === DiscountType.PERCENTAGE) {
            discountAmount = (subtotal * promo.discount_value) / 100;
            // Apply max discount cap if set
            if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
                discountAmount = promo.max_discount_amount;
            }
        } else {
            discountAmount = promo.discount_value;
        }

        // Ensure discount doesn't exceed subtotal
        if (discountAmount > subtotal) {
            discountAmount = subtotal;
        }

        return {
            valid: true,
            promo_code: promo,
            discount_amount: Math.round(discountAmount * 100) / 100, // Round to 2 decimals
        };
    }

    /**
     * Apply a promo code to an order (increment usage, record usage)
     */
    async applyPromoCode(
        promoCodeId: string,
        userId: string,
        orderId: string,
        discountApplied: number,
    ): Promise<void> {
        // Increment usage count
        await this.promoCodeRepository.increment(
            { id: promoCodeId },
            'usage_count',
            1,
        );

        // Record usage
        const usage = this.promoUsageRepository.create({
            promo_code_id: promoCodeId,
            user_id: userId,
            order_id: orderId,
            discount_applied: discountApplied,
        });
        await this.promoUsageRepository.save(usage);
    }

    /**
     * Get promo code stats
     */
    async getPromoCodeStats(id: string) {
        const promo = await this.findById(id);
        const usages = await this.promoUsageRepository.find({
            where: { promo_code_id: id },
            relations: ['user', 'order'],
            order: { used_at: 'DESC' },
            take: 50,
        });

        const totalDiscountGiven = usages.reduce(
            (sum, u) => sum + Number(u.discount_applied),
            0,
        );

        return {
            promo_code: promo,
            total_usages: promo.usage_count,
            total_discount_given: totalDiscountGiven,
            remaining_uses: promo.usage_limit
                ? promo.usage_limit - promo.usage_count
                : 'Unlimited',
            recent_usages: usages,
        };
    }
}
