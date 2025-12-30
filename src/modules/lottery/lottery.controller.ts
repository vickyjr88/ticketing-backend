import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LotteryService } from './lottery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('lottery')
@Controller('lottery')
export class LotteryController {
  constructor(private lotteryService: LotteryService) { }

  @UseGuards(JwtAuthGuard)
  @Post('enter/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enter lottery for an event' })
  async enter(@Param('eventId') eventId: string, @Request() req) {
    return this.lotteryService.enterLottery(req.user.userId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('opt-out/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opt out of lottery for an event' })
  async optOut(@Param('eventId') eventId: string, @Request() req) {
    return this.lotteryService.optOutOfLottery(req.user.userId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('draw/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run lottery draw (Admin only)' })
  async draw(@Param('eventId') eventId: string) {
    return this.lotteryService.runLotteryDraw(eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('allocate/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually allocate a ticket to a user (Admin only)' })
  async allocate(@Param('eventId') eventId: string, @Body('email') email: string) {
    return this.lotteryService.allocateTicketManually(eventId, email);
  }

  @Get('event/:eventId/entries')
  @ApiOperation({ summary: 'Get lottery entries for an event' })
  async getEntries(@Param('eventId') eventId: string) {
    return this.lotteryService.getEntriesByEvent(eventId);
  }

  @Get('event/:eventId/winners')
  @ApiOperation({ summary: 'Get lottery winners for an event' })
  async getWinners(@Param('eventId') eventId: string) {
    return this.lotteryService.getWinnersByEvent(eventId);
  }

  @Get('event/:eventId/stats')
  @ApiOperation({ summary: 'Get lottery statistics' })
  async getStats(@Param('eventId') eventId: string) {
    return this.lotteryService.getStats(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-entries')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user lottery entries with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyEntries(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.lotteryService.getUserEntries(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('eligible/:eventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user is eligible for lottery' })
  async checkEligibility(@Param('eventId') eventId: string, @Request() req) {
    const eligible = await this.lotteryService.isEligible(
      req.user.userId,
      eventId,
    );
    return { eligible };
  }
}
