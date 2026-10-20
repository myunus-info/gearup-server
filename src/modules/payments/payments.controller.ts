import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../auth/entities/user.entity.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz payment confirmation webhook / IPN callback' })
  @ApiResponse({ status: 200, description: 'Payment successfully confirmed and order status updated' })
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    const result = await this.paymentsService.confirmPayment(dto);
    return {
      message: 'Payment confirmed successfully',
      data: result,
    };
  }

  @Get()
  @Auth(Role.CUSTOMER)
  @ApiOperation({ summary: 'List customer payment transaction history' })
  async getMyPayments(@CurrentUser() user: User) {
    const payments = await this.paymentsService.getMyPayments(user.id);
    return {
      message: 'Payments retrieved successfully',
      data: payments,
    };
  }

  @Get(':id')
  @Auth(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get payment details by ID' })
  async getPaymentById(@Param('id') id: string, @CurrentUser() user: User) {
    const payment = await this.paymentsService.getPaymentById(id, user.id);
    return {
      message: 'Payment retrieved successfully',
      data: payment,
    };
  }
}
