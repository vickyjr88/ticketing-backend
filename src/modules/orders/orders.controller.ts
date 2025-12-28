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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { AdoptTicketDto } from './dto/adopt-ticket.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

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
  @ApiOperation({ summary: 'Get current user orders' })
  async getMyOrders(@Request() req) {
    return this.ordersService.getUserOrders(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }
}
