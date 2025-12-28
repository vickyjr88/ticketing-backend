import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user tickets' })
  async getMyTickets(@Request() req) {
    return this.ticketsService.getUserTickets(req.user.userId);
  }

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
  @Post('check-in')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in a ticket (Scanner only)' })
  async checkIn(
    @Body('qrHash') qrHash: string,
    @Request() req,
  ) {
    return this.ticketsService.checkIn(qrHash, req.user.userId);
  }
}
