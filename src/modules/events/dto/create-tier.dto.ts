import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { TierCategory } from '../../../entities/ticket-tier.entity';

export class CreateTierDto {
  @ApiProperty({ example: 'Die Hard Early Bird' })
  @IsString()
  name: string;

  @ApiProperty({ enum: TierCategory, default: TierCategory.REGULAR })
  @IsEnum(TierCategory)
  category: TierCategory;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: 1, description: 'Number of tickets per unit (e.g., 10 for a table)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  tickets_per_unit?: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  initial_quantity: number;

  @ApiProperty({ example: 10, description: 'Maximum quantity per order to prevent scalping' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  max_qty_per_order?: number;

  @ApiProperty({ required: false, description: 'When sales start (for flash sales)' })
  @IsOptional()
  @IsDateString()
  sales_start?: string;

  @ApiProperty({ required: false, description: 'When sales end (for die hard tickets)' })
  @IsOptional()
  @IsDateString()
  sales_end?: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
