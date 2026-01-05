import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    DefaultValuePipe,
    Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LayawayService } from './layaway.service';
import { CreateLayawayOrderDto, TopUpPaymentDto } from './dto/layaway.dto';

@ApiTags('layaway')
@Controller('layaway')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LayawayController {
    constructor(private readonly layawayService: LayawayService) { }

    @Post('orders')
    @ApiOperation({ summary: 'Create a new Lipa Pole Pole (layaway) order' })
    async createLayawayOrder(
        @Request() req,
        @Body() dto: CreateLayawayOrderDto,
    ) {
        return this.layawayService.createLayawayOrder(req.user.userId, dto);
    }

    @Get('orders')
    @ApiOperation({ summary: 'Get user\'s layaway orders' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PARTIAL', 'PAID'] })
    async getLayawayOrders(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('status') status?: string,
    ) {
        return this.layawayService.getUserLayawayOrders(req.user.userId, page, limit, status);
    }

    @Get('orders/:id')
    @ApiOperation({ summary: 'Get a specific layaway order with payment history' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    async getLayawayOrder(
        @Request() req,
        @Param('id') orderId: string,
    ) {
        const order = await this.layawayService.getLayawayOrder(req.user.userId, orderId);
        return {
            ...order,
            balance_due: Number(order.total_amount) - Number(order.amount_paid),
            is_fully_paid: Number(order.amount_paid) >= Number(order.total_amount),
        };
    }

    @Get('orders/:id/payments')
    @ApiOperation({ summary: 'Get payment history for a layaway order' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    async getPaymentHistory(
        @Request() req,
        @Param('id') orderId: string,
    ) {
        return this.layawayService.getPaymentHistory(req.user.userId, orderId);
    }

    @Post('orders/:id/pay')
    @ApiOperation({ summary: 'Make a top-up payment on a layaway order' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    async topUpPayment(
        @Request() req,
        @Param('id') orderId: string,
        @Body() dto: TopUpPaymentDto,
    ) {
        return this.layawayService.topUpPayment(req.user.userId, orderId, dto);
    }

    @Delete('orders/:id')
    @ApiOperation({ summary: 'Cancel a layaway order (refund will be processed for any payments made)' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    async cancelLayawayOrder(
        @Request() req,
        @Param('id') orderId: string,
    ) {
        return this.layawayService.cancelLayawayOrder(req.user.userId, orderId);
    }

    @Post('callback/mpesa')
    @ApiOperation({ summary: 'M-Pesa callback for layaway payments' })
    async mpesaCallback(@Body() body: any) {
        // This will be handled by the payment service
        // The M-Pesa service should call processPartialPaymentSuccess
        return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    @Get('callback/paystack')
    @ApiOperation({ summary: 'Paystack callback for layaway payments' })
    async paystackCallback(
        @Query('reference') reference: string,
        @Query('trxref') trxref: string,
    ) {
        const paymentId = reference || trxref;
        if (paymentId) {
            await this.layawayService.processPartialPaymentSuccess(paymentId);
        }
        return { success: true };
    }
}
