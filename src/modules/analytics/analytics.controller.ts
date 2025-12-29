import {
    Controller,
    Get,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get full analytics dashboard data' })
    @ApiQuery({ name: 'days', required: false, description: 'Number of days for time series (default: 30)' })
    @ApiQuery({ name: 'eventId', required: false, description: 'Filter by specific event' })
    async getFullDashboard(
        @Query('days') days?: string,
        @Query('eventId') eventId?: string,
    ) {
        return this.analyticsService.getFullDashboard(
            parseInt(days) || 30,
            eventId || undefined,
        );
    }

    @Get('sales-timeseries')
    @ApiOperation({ summary: 'Get ticket sales over time' })
    @ApiQuery({ name: 'days', required: false })
    @ApiQuery({ name: 'eventId', required: false })
    async getSalesTimeSeries(
        @Query('days') days?: string,
        @Query('eventId') eventId?: string,
    ) {
        return this.analyticsService.getSalesTimeSeries(
            parseInt(days) || 30,
            eventId || undefined,
        );
    }

    @Get('checkin-distribution')
    @ApiOperation({ summary: 'Get check-in times distribution (for staffing)' })
    @ApiQuery({ name: 'eventId', required: false })
    async getCheckInDistribution(@Query('eventId') eventId?: string) {
        return this.analyticsService.getCheckInDistribution(eventId || undefined);
    }

    @Get('customer-retention')
    @ApiOperation({ summary: 'Get customer retention metrics' })
    async getCustomerRetention() {
        return this.analyticsService.getCustomerRetention();
    }

    @Get('activity-breakdown')
    @ApiOperation({ summary: 'Get activity breakdown by type' })
    async getActivityBreakdown() {
        return this.analyticsService.getActivityBreakdown();
    }

    @Get('activity-feed')
    @ApiOperation({ summary: 'Get recent activity feed' })
    @ApiQuery({ name: 'limit', required: false })
    async getActivityFeed(@Query('limit') limit?: string) {
        return this.analyticsService.getActivityFeed(parseInt(limit) || 50);
    }

    @Get('revenue-by-event')
    @ApiOperation({ summary: 'Get revenue breakdown by event' })
    async getRevenueByEvent() {
        return this.analyticsService.getRevenueByEvent();
    }

    @Get('gate-performance')
    @ApiOperation({ summary: 'Get gate check-in performance' })
    @ApiQuery({ name: 'eventId', required: false })
    async getGatePerformance(@Query('eventId') eventId?: string) {
        return this.analyticsService.getGatePerformance(eventId || undefined);
    }

    @Get('ticket-type-trend')
    @ApiOperation({ summary: 'Get ticket type breakdown over time' })
    @ApiQuery({ name: 'days', required: false })
    async getTicketTypeTrend(@Query('days') days?: string) {
        return this.analyticsService.getTicketTypeTrend(parseInt(days) || 30);
    }
}
