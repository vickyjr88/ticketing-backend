import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { EventStatus } from '../../../entities/event.entity';

export class CreateEventDto {
  @ApiProperty({ example: 'Home Run with Pipita' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'An amazing night of fun and celebration' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Carnivore Grounds, Nairobi' })
  @IsString()
  venue: string;

  @ApiProperty({ example: '2024-12-25T18:00:00Z' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2024-12-26T02:00:00Z' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  banner_image_url?: string;

  @ApiProperty({ enum: EventStatus, default: EventStatus.DRAFT })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  lottery_enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  lottery_draw_date?: string;

  @ApiProperty({ default: false, description: 'Enable Lipa Pole Pole (layaway payments) for this event' })
  @IsOptional()
  @IsBoolean()
  allows_layaway?: boolean;
}
