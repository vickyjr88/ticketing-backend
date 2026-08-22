import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../entities/user.entity';

export class CreateAdminUserDto {
    @ApiProperty({ example: 'scanner@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'scanner123', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({ example: 'Jane' })
    @IsOptional()
    @IsString()
    first_name?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsString()
    last_name?: string;

    @ApiPropertyOptional({ example: '+254712345678' })
    @IsOptional()
    @IsString()
    phone_number?: string;

    @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiPropertyOptional({ example: 'Main Entrance' })
    @IsOptional()
    @IsString()
    assigned_gate?: string;
}

export class SetUserPasswordDto {
    @ApiProperty({ example: 'newpassword123', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;
}
