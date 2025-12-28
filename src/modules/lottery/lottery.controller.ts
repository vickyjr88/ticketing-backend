import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get current user lottery entries' })
  async getMyEntries(@Request() req) {
    return this.lotteryService.getUserEntries(req.user.userId);
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
