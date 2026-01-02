import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from '../../entities/contact-message.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ContactMessage]),
        EmailModule,
    ],
    controllers: [ContactController],
    providers: [ContactService],
    exports: [ContactService],
})
export class ContactModule { }
