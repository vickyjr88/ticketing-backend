import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContactMessageStatus, ContactSubject } from '../../../entities/contact-message.entity';

export class CreateContactMessageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    phone?: string;

    @IsEnum(ContactSubject)
    @IsOptional()
    subject?: ContactSubject;

    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(2000)
    message: string;
}

export class UpdateContactMessageDto {
    @IsEnum(ContactMessageStatus)
    @IsOptional()
    status?: ContactMessageStatus;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    admin_notes?: string;
}

export class ReplyContactMessageDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(5000)
    reply_message: string;
}

export class ContactQueryDto {
    @IsEnum(ContactMessageStatus)
    @IsOptional()
    status?: ContactMessageStatus;

    @IsEnum(ContactSubject)
    @IsOptional()
    subject?: ContactSubject;

    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;
}
