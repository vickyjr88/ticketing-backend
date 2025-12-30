import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsArray } from 'class-validator';

export class ValidatePromoCodeDto {
    @ApiProperty({ example: 'EARLY10' })
    @IsString()
    code: string;

    @ApiProperty({ description: 'Event ID to validate against' })
    @IsString()
    eventId: string;

    @ApiPropertyOptional({ description: 'List of product IDs in the cart' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    productIds?: string[];

    @ApiProperty({ description: 'Order subtotal before discount' })
    @IsNumber()
    @Min(0)
    subtotal: number;
}
