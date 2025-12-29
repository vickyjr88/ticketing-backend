import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class InitiatePaymentDto {
  @ApiPropertyOptional({ description: 'Phone number for M-Pesa payment' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Success redirect URL for Stripe/Paystack' })
  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'Cancel redirect URL for Stripe' })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
