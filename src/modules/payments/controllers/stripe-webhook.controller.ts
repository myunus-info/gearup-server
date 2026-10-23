import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from '../payments.service.js';

@ApiTags('Payments')
@Controller('payments')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(['stripe/webhook', 'webhook'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook listener for asynchronous checkout confirmation' })
  @ApiResponse({ status: 200, description: 'Webhook event received and processed' })
  async handleStripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(body, signature);
  }
}
