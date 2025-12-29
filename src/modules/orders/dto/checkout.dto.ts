import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, ValidateNested, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider } from '../../../entities/order.entity';

class CheckoutItem {
  @ApiProperty()
  @IsString()
  tierId: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  eventId: string;

  @ApiProperty({ type: [CheckoutItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItem)
  items: CheckoutItem[];

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;

  @ApiPropertyOptional({ description: 'Promo code to apply' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
