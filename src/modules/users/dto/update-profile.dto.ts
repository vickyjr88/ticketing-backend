import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    first_name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    last_name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phone_number?: string;
}
