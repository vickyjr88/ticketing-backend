import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ContactService } from './contact.service';
import {
    CreateContactMessageDto,
    UpdateContactMessageDto,
    ReplyContactMessageDto,
    ContactQueryDto,
} from './dto/contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('contact')
export class ContactController {
    constructor(private readonly contactService: ContactService) { }

    // Public endpoint - submit contact form
    @Post()
    async submitContact(
        @Body() dto: CreateContactMessageDto,
        @Req() req: Request,
    ) {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        return this.contactService.createMessage(dto, ipAddress, userAgent);
    }

    // Admin endpoints
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAll(@Query() query: ContactQueryDto) {
        return this.contactService.findAll(query);
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getStats() {
        return this.contactService.getStats();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getOne(@Param('id', ParseUUIDPipe) id: string) {
        // Mark as read when viewing
        await this.contactService.markAsRead(id);
        return this.contactService.findOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateContactMessageDto,
    ) {
        return this.contactService.update(id, dto);
    }

    @Post(':id/reply')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async reply(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReplyContactMessageDto,
        @Req() req: Request,
    ) {
        const user = req.user as any;
        return this.contactService.replyToMessage(id, dto, user.id);
    }

    @Put(':id/archive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async archive(@Param('id', ParseUUIDPipe) id: string) {
        return this.contactService.archive(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        await this.contactService.delete(id);
        return { message: 'Message deleted successfully' };
    }
}
