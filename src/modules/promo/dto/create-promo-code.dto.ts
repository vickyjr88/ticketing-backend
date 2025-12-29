import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsDateString,
    Min,
    MaxLength,
} from 'class-validator';
import { DiscountType } from '../../../entities/promo-code.entity';

export class CreatePromoCodeDto {
    @ApiProperty({ example: 'EARLY10' })
    @IsString()
    @MaxLength(50)
    code: string;

    @ApiPropertyOptional({ example: 'Early bird 10% discount' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: DiscountType })
    @IsEnum(DiscountType)
    discount_type: DiscountType;

    @ApiProperty({ example: 10, description: 'Discount value (10 for 10% or 500 for KES 500)' })
    @IsNumber()
    @Min(0)
    discount_value: number;

    @ApiPropertyOptional({ description: 'Restrict to specific event' })
    @IsOptional()
    @IsString()
    event_id?: string;

    @ApiPropertyOptional({ example: 50, description: 'Max total uses' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    usage_limit?: number;

    @ApiPropertyOptional({ example: 1, description: 'Max uses per user' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    per_user_limit?: number;

    @ApiPropertyOptional({ example: 1000, description: 'Minimum order amount' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    min_order_amount?: number;

    @ApiPropertyOptional({ example: 5000, description: 'Max discount cap (for percentage)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    max_discount_amount?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    valid_from?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    valid_until?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
