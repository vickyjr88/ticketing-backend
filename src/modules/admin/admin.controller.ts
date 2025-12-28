import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Get admin dashboard statistics' })
    async getStats() {
        return this.adminService.getDashboardStats();
    }

    @Get('orders')
    @ApiOperation({ summary: 'Get all orders with pagination and filtering' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, type: String })
    async getOrders(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
        @Query('status') status?: string,
    ) {
        return this.adminService.getOrders(page, limit, status);
    }

    @Get('users')
    @ApiOperation({ summary: 'Get all users with pagination and filtering' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'role', required: false, enum: UserRole })
    async getUsers(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
        @Query('role') role?: string,
    ) {
        return this.adminService.getUsers(page, limit, role);
    }

    @Patch('users/:id/role')
    @ApiOperation({ summary: 'Update user role' })
    async updateUserRole(
        @Param('id') id: string,
        @Body('role') role: UserRole,
    ) {
        return this.adminService.updateUserRole(id, role);
    }

    @Patch('users/:id/status')
    @ApiOperation({ summary: 'Update user active status' })
    async updateUserStatus(
        @Param('id') id: string,
        @Body('is_active') isActive: boolean,
    ) {
        return this.adminService.updateUserStatus(id, isActive);
    }
}
