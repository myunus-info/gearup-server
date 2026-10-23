import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { PaymentsController } from './payments.controller.js';
import { StripeWebhookController } from './controllers/stripe-webhook.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory.js';
import { SslcommerzGateway } from './gateways/sslcommerz.gateway.js';
import { StripeGateway } from './gateways/stripe.gateway.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, RentalOrder])],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [
    PaymentsService,
    PaymentGatewayFactory,
    SslcommerzGateway,
    StripeGateway,
  ],
  exports: [
    PaymentsService,
    PaymentGatewayFactory,
    SslcommerzGateway,
    StripeGateway,
  ],
})
export class PaymentsModule {}
