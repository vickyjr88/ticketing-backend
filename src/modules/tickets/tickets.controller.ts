import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) { }

  // --- SPECIFIC ROUTES FIRST (before :id) ---

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user tickets with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyTickets(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ticketsService.getUserTickets(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('scanner/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get global scanner stats (all events)' })
  async getGlobalScannerStats() {
    return this.ticketsService.getGlobalScannerStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('scanner/stats/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gate ingress stats for an event (Admin/Scanner)' })
  async getGateStats(@Param('eventId') eventId: string) {
    return this.ticketsService.getGateStats(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('check-in')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in a ticket (Scanner only)' })
  async checkIn(
    @Body('qrHash') qrHash: string,
    @Request() req,
  ) {
    return this.ticketsService.checkIn(qrHash, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('issue-complimentary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue complimentary tickets (Admin only)' })
  async issueComplimentary(
    @Body() body: { eventId: string; tierId: string; email: string; quantity: number },
    @Request() req,
  ) {
    return this.ticketsService.issueComplimentaryTickets(
      req.user.userId,
      body.eventId,
      body.tierId,
      body.email,
      body.quantity,
    );
  }

  // --- PARAMETERIZED ROUTES LAST ---

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ticket by ID' })
  async getTicket(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/qr-code')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code for ticket' })
  async getQRCode(@Param('id') id: string) {
    const qrCode = await this.ticketsService.generateQRCode(id);
    return { qrCode };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transfer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transfer ticket to another user' })
  async transferTicket(
    @Param('id') id: string,
    @Body('email') email: string,
    @Request() req,
  ) {
    return this.ticketsService.transferTicket(id, req.user.userId, email);
  }
}
