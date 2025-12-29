import { Controller, Post, Body, Get, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    @UseGuards(OptionalJwtAuthGuard)
    @Post()
    @ApiOperation({ summary: 'Join waitlist for a specific tier' })
    async joinWaitlist(@Body() joinDto: JoinWaitlistDto, @Request() req) {
        const userId = req.user?.userId;
        return this.waitlistService.join(joinDto, userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('event/:eventId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get waitlist count/stats for an event (Admin)' })
    async getEventWaitlist(@Param('eventId') eventId: string) {
        // In a real app, check for admin/organizer role here
        return this.waitlistService.getStatsByEvent(eventId);
    }
}
