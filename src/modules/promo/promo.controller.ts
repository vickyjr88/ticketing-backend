import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PromoService } from './promo.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@ApiTags('Promo Codes')
@Controller('promo')
export class PromoController {
    constructor(private readonly promoService: PromoService) { }

    // ============ Admin Endpoints ============

    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new promo code (Admin only)' })
    async create(@Body() dto: CreatePromoCodeDto) {
        return this.promoService.create(dto);
    }

    @Get()
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all promo codes (Admin only)' })
    async findAll(@Query('includeInactive') includeInactive?: string) {
        return this.promoService.findAll(includeInactive === 'true');
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get promo code by ID (Admin only)' })
    async findById(@Param('id') id: string) {
        return this.promoService.findById(id);
    }

    @Get(':id/stats')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get promo code usage stats (Admin only)' })
    async getStats(@Param('id') id: string) {
        return this.promoService.getPromoCodeStats(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a promo code (Admin only)' })
    async update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
        return this.promoService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a promo code (Admin only)' })
    async delete(@Param('id') id: string) {
        await this.promoService.delete(id);
        return { message: 'Promo code deleted successfully' };
    }

    // ============ Public/User Endpoints ============

    @Post('validate')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Validate a promo code' })
    async validate(@Request() req, @Body() dto: ValidatePromoCodeDto) {
        const result = await this.promoService.validatePromoCode(
            dto.code,
            req.user.id,
            dto.eventId,
            dto.subtotal,
            dto.productIds,
        );

        if (!result.valid) {
            return {
                valid: false,
                error: result.error,
            };
        }

        return {
            valid: true,
            discount_type: result.promo_code.discount_type,
            discount_value: result.promo_code.discount_value,
            discount_amount: result.discount_amount,
            code: result.promo_code.code,
            description: result.promo_code.description,
        };
    }
}
