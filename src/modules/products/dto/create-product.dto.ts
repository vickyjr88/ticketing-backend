import { IsString, IsNumber, IsOptional, IsEnum, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '../../../entities/product.entity';

export class CreateProductDto {
    @ApiProperty()
    @IsString()
    eventId: string;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    price: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    stock: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiProperty({ enum: ProductType })
    @IsEnum(ProductType)
    type: ProductType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
