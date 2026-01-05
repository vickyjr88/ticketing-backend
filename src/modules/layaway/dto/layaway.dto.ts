import { IsUUID, IsNumber, IsOptional, IsString, Min, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLayawayOrderDto {
    @ApiProperty({ description: 'Event ID' })
    @IsUUID()
    eventId: string;

    @ApiProperty({ description: 'Ticket tier items', type: 'array' })
    items: Array<{ tierId: string; quantity: number }>;

    @ApiPropertyOptional({ description: 'Product items' })
    @IsOptional()
    products?: Array<{ productId: string; quantity: number }>;

    @ApiProperty({ description: 'Initial payment amount' })
    @IsNumber()
    @Min(1)
    initialAmount: number;

    @ApiProperty({ description: 'Payment provider', enum: ['MPESA', 'STRIPE', 'PAYSTACK'] })
    @IsString()
    paymentProvider: string;

    @ApiPropertyOptional({ description: 'Phone number for M-Pesa' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Promo code' })
    @IsOptional()
    @IsString()
    promoCode?: string;

    @ApiPropertyOptional({ description: 'Payment deadline' })
    @IsOptional()
    @IsDateString()
    layawayDeadline?: string;
}

export class TopUpPaymentDto {
    @ApiProperty({ description: 'Top-up amount' })
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({ description: 'Payment provider', enum: ['MPESA', 'STRIPE', 'PAYSTACK'] })
    @IsString()
    paymentProvider: string;

    @ApiPropertyOptional({ description: 'Phone number for M-Pesa' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Success URL for card payments' })
    @IsOptional()
    @IsString()
    successUrl?: string;

    @ApiPropertyOptional({ description: 'Cancel URL for card payments' })
    @IsOptional()
    @IsString()
    cancelUrl?: string;
}

export class LayawayOrderQueryDto {
    @ApiPropertyOptional({ description: 'Filter by status' })
    @IsOptional()
    @IsEnum(['PENDING', 'PARTIAL', 'PAID'])
    status?: string;

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', default: 20 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    limit?: number;
}
