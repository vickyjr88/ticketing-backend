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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { AdoptTicketDto } from './dto/adopt-ticket.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) { }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Standard/Group ticket purchase' })
  async checkout(@Request() req, @Body() checkoutDto: CheckoutDto) {
    return this.ordersService.checkout(req.user.userId, checkoutDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('adopt')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adopt-a-Ticket purchase' })
  async adopt(@Request() req, @Body() adoptDto: AdoptTicketDto) {
    return this.ordersService.adoptCheckout(req.user.userId, adoptDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-orders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user orders with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyOrders(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.getUserOrders(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }
}
