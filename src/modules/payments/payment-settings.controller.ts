import {
    Controller,
    Get,
    Put,
    Body,
    Param,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentProvider } from '../../entities/order.entity';

@ApiTags('payment-settings')
@Controller('payments/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class PaymentSettingsController {
    constructor(private settingsService: PaymentSettingsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all payment configurations' })
    async getAll() {
        return this.settingsService.getAllConfigs();
    }

    @Get(':provider')
    @ApiOperation({ summary: 'Get configuration for a specific provider' })
    async getOne(@Param('provider') provider: PaymentProvider) {
        const config = await this.settingsService.getConfig(provider);
        if (!config) throw new NotFoundException('Configuration not found');
        return config;
    }

    @Put(':provider')
    @ApiOperation({ summary: 'Update configuration for a provider' })
    async update(
        @Param('provider') provider: PaymentProvider,
        @Body() body: any, // Use DTO ideally, but any is acceptable for dynamic jsonb config
    ) {
        return this.settingsService.updateConfig(provider, body);
    }
}
