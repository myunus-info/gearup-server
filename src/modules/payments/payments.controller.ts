import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../auth/entities/user.entity.js';
import { PaymentProvider } from '../../common/enums/payment-provider.enum.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(['initiate', 'create'])
  @Auth(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate payment session (Stripe or SSLCommerz) for an existing rental order' })
  @ApiResponse({ status: 200, description: 'Payment checkout session created with redirection URL' })
  async initiatePayment(@Body() dto: InitiatePaymentDto, @CurrentUser() user: User) {
    const result = await this.paymentsService.initiateOrderPayment(dto.orderId, user.id, dto.provider);
    return {
      message: 'Payment session initiated successfully',
      data: result,
    };
  }

  @Post(['confirm', 'ipn'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify and confirm payment (supports both Stripe and SSLCommerz)' })
  @ApiResponse({ status: 200, description: 'Payment successfully confirmed and order status updated' })
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    const result = await this.paymentsService.confirmPayment(dto);
    return {
      message: 'Payment confirmed successfully',
      data: result,
    };
  }

  /**
   * SSLCommerz background server-to-server IPN webhook listener.
   */
  @Post('sslcommerz/ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz IPN (Instant Payment Notification) background listener' })
  async handleSslcommerzIpn(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    const orderId =
      (query?.orderId as string) ||
      (body?.value_a as string) ||
      (body?.orderId as string);
    const tranId =
      (body?.tran_id as string) ||
      (query?.tranId as string) ||
      (body?.value_c as string);
    const valId = body?.val_id as string | undefined;

    this.logger.log(`SSLCommerz IPN notification received for order: ${orderId}, valId: ${valId}`);

    if (orderId) {
      await this.paymentsService.confirmPayment({
        orderId,
        tranId: tranId || valId,
        provider: PaymentProvider.SSLCOMMERZ,
        payload: { ...body, ...query },
      });
    }

    return {
      message: 'SSLCommerz IPN processed successfully',
      received: true,
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
