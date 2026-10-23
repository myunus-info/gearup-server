import {
  All,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
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

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

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
   * Approach B (Industry Standard): Backend callback endpoint for SSLCommerz success return.
   * Atomically verifies transaction with SSLCommerz, marks order CONFIRMED, and redirects browser to frontend via HTTP 303.
   */
  @All('sslcommerz/success')
  @ApiOperation({
    summary: 'Handle SSLCommerz success return callback, atomically confirm payment, and redirect to frontend receipt',
  })
  async handleSslcommerzSuccess(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
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
    const amount = (body?.amount as string) || (query?.amount as string);

    this.logger.log(
      `SSLCommerz success callback received for order: ${orderId}, tranId: ${tranId}, valId: ${valId}`,
    );

    let isSuccess = false;
    if (orderId) {
      try {
        await this.paymentsService.confirmPayment({
          orderId,
          tranId: tranId || valId,
          provider: PaymentProvider.SSLCOMMERZ,
          payload: { ...body, ...query },
        });
        isSuccess = true;
      } catch (err: any) {
        this.logger.error(
          `Error confirming payment during SSLCommerz callback for order ${orderId}: ${err?.message}`,
        );
      }
    }

    const clientUrl =
      this.configService.get<string>('CLIENT_URL') ||
      'https://gearup-six-kohl.vercel.app';

    if (isSuccess) {
      const redirectUrl = new URL('/payment/success', clientUrl);
      if (orderId) redirectUrl.searchParams.set('orderId', orderId);
      if (tranId) redirectUrl.searchParams.set('tranId', tranId);
      if (valId) redirectUrl.searchParams.set('val_id', valId);
      if (amount) redirectUrl.searchParams.set('amount', amount);
      redirectUrl.searchParams.set('gateway', 'SSLCOMMERZ');
      redirectUrl.searchParams.set('status', 'success');

      return res.redirect(303, redirectUrl.toString());
    }

    // If confirmation failed, redirect to fail page cleanly
    const failUrl = new URL('/payment/fail', clientUrl);
    if (orderId) failUrl.searchParams.set('orderId', orderId);
    if (tranId) failUrl.searchParams.set('tranId', tranId);
    failUrl.searchParams.set('gateway', 'SSLCOMMERZ');
    failUrl.searchParams.set('status', 'fail');
    return res.redirect(303, failUrl.toString());
  }

  /**
   * Approach B: Backend callback endpoint for SSLCommerz payment failure.
   */
  @All('sslcommerz/fail')
  @ApiOperation({
    summary: 'Handle SSLCommerz fail callback, mark payment as failed, and redirect to frontend fail page',
  })
  async handleSslcommerzFail(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const orderId =
      (query?.orderId as string) ||
      (body?.value_a as string) ||
      (body?.orderId as string);
    const tranId =
      (body?.tran_id as string) ||
      (query?.tranId as string) ||
      (body?.value_c as string);

    this.logger.warn(`SSLCommerz payment failed for order ${orderId}, tranId: ${tranId}`);

    if (orderId) {
      try {
        await this.paymentsService.recordFailedPayment(orderId, tranId, body);
      } catch (err: any) {
        this.logger.warn(`Failed to record failed payment status: ${err?.message}`);
      }
    }

    const clientUrl =
      this.configService.get<string>('CLIENT_URL') ||
      'https://gearup-six-kohl.vercel.app';
    const redirectUrl = new URL('/payment/fail', clientUrl);
    if (orderId) redirectUrl.searchParams.set('orderId', orderId);
    if (tranId) redirectUrl.searchParams.set('tranId', tranId);
    redirectUrl.searchParams.set('gateway', 'SSLCOMMERZ');
    redirectUrl.searchParams.set('status', 'fail');

    return res.redirect(303, redirectUrl.toString());
  }

  /**
   * Approach B: Backend callback endpoint for SSLCommerz payment cancellation.
   */
  @All('sslcommerz/cancel')
  @ApiOperation({
    summary: 'Handle SSLCommerz cancel callback, mark payment as canceled, and redirect to frontend cancel page',
  })
  async handleSslcommerzCancel(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const orderId =
      (query?.orderId as string) ||
      (body?.value_a as string) ||
      (body?.orderId as string);
    const tranId =
      (body?.tran_id as string) ||
      (query?.tranId as string) ||
      (body?.value_c as string);

    this.logger.log(`SSLCommerz payment canceled by customer for order ${orderId}, tranId: ${tranId}`);

    if (orderId) {
      try {
        await this.paymentsService.recordFailedPayment(orderId, tranId, body);
      } catch (err: any) {
        this.logger.warn(`Failed to record canceled payment status: ${err?.message}`);
      }
    }

    const clientUrl =
      this.configService.get<string>('CLIENT_URL') ||
      'https://gearup-six-kohl.vercel.app';
    const redirectUrl = new URL('/payment/cancel', clientUrl);
    if (orderId) redirectUrl.searchParams.set('orderId', orderId);
    if (tranId) redirectUrl.searchParams.set('tranId', tranId);
    redirectUrl.searchParams.set('gateway', 'SSLCOMMERZ');
    redirectUrl.searchParams.set('status', 'cancel');

    return res.redirect(303, redirectUrl.toString());
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
