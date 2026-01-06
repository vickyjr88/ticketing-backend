import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Post('register-device')
    @ApiOperation({ summary: 'Register FCM device token for push notifications' })
    async registerDevice(@Request() req, @Body('token') token: string) {
        return this.notificationsService.registerDevice(req.user.userId, token);
    }
}
