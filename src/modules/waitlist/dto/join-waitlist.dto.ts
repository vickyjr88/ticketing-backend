import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinWaitlistDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    eventId: string;

    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    tierId: string;

    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phoneNumber?: string;
}
