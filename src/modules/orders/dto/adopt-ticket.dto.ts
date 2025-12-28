import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { PaymentProvider } from '../../../entities/order.entity';

export class AdoptTicketDto {
  @ApiProperty()
  @IsString()
  eventId: string;

  @ApiProperty()
  @IsString()
  tierId: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;
}
