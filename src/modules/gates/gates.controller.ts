import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { GatesService } from './gates.service';
import {
    CreateGateDto,
    UpdateGateDto,
    AssignGateToEventDto,
    AssignScannerDto,
    BulkAssignGatesDto,
} from './dto/gate.dto';

@Controller('gates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GatesController {
    constructor(private readonly gatesService: GatesService) { }

    // ==================== GATE CRUD ====================

    @Post()
    @Roles(UserRole.ADMIN)
    async createGate(@Body() createGateDto: CreateGateDto) {
        return this.gatesService.createGate(createGateDto);
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.SCANNER)
    async getAllGates(@Query('includeInactive') includeInactive?: string) {
        return this.gatesService.getAllGates(includeInactive === 'true');
    }

    @Get('with-stats')
    @Roles(UserRole.ADMIN)
    async getGatesWithStats() {
        return this.gatesService.getGatesWithStats();
    }

    @Get('scanners')
    @Roles(UserRole.ADMIN)
    async getScanners() {
        return this.gatesService.getScanners();
    }

    @Get(':id')
    @Roles(UserRole.ADMIN)
    async getGate(@Param('id', ParseUUIDPipe) id: string) {
        return this.gatesService.getGate(id);
    }

    @Put(':id')
    @Roles(UserRole.ADMIN)
    async updateGate(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateGateDto: UpdateGateDto,
    ) {
        return this.gatesService.updateGate(id, updateGateDto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    async deleteGate(@Param('id', ParseUUIDPipe) id: string) {
        await this.gatesService.deleteGate(id);
        return { message: 'Gate deleted successfully' };
    }

    // ==================== GATE ASSIGNMENTS ====================

    @Post('assign')
    @Roles(UserRole.ADMIN)
    async assignGateToEvent(@Body() dto: AssignGateToEventDto) {
        return this.gatesService.assignGateToEvent(dto);
    }

    @Post('bulk-assign')
    @Roles(UserRole.ADMIN)
    async bulkAssignGatesToEvent(@Body() dto: BulkAssignGatesDto) {
        return this.gatesService.bulkAssignGatesToEvent(dto);
    }

    @Get('event/:eventId')
    @Roles(UserRole.ADMIN, UserRole.SCANNER)
    async getEventGates(@Param('eventId', ParseUUIDPipe) eventId: string) {
        return this.gatesService.getEventGates(eventId);
    }

    @Delete('assignment/:assignmentId')
    @Roles(UserRole.ADMIN)
    async removeGateFromEvent(
        @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    ) {
        await this.gatesService.removeGateFromEvent(assignmentId);
        return { message: 'Gate removed from event successfully' };
    }

    @Put('assignment/:assignmentId/scanner')
    @Roles(UserRole.ADMIN)
    async assignScannerToGate(
        @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
        @Body() dto: AssignScannerDto,
    ) {
        return this.gatesService.assignScannerToGate(assignmentId, dto.scanner_id);
    }

    @Delete('assignment/:assignmentId/scanner')
    @Roles(UserRole.ADMIN)
    async removeScannerFromGate(
        @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    ) {
        return this.gatesService.assignScannerToGate(assignmentId, null);
    }

    // ==================== SCANNER ENDPOINTS ====================

    @Get('scanner/:scannerId/assignments')
    @Roles(UserRole.ADMIN, UserRole.SCANNER)
    async getScannerAssignments(
        @Param('scannerId', ParseUUIDPipe) scannerId: string,
    ) {
        return this.gatesService.getScannerAssignments(scannerId);
    }
}
