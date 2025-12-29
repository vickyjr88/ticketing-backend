import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class ValidatePromoCodeDto {
    @ApiProperty({ example: 'EARLY10' })
    @IsString()
    code: string;

    @ApiProperty({ description: 'Event ID to validate against' })
    @IsString()
    eventId: string;

    @ApiProperty({ description: 'Order subtotal before discount' })
    @IsNumber()
    @Min(0)
    subtotal: number;
}
