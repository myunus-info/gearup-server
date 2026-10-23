import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SslcommerzService } from './sslcommerz.service.js';
import { StripeService } from './stripe.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, RentalOrder])],
  controllers: [PaymentsController],
  providers: [PaymentsService, SslcommerzService, StripeService],
  exports: [PaymentsService, SslcommerzService, StripeService],
})
export class PaymentsModule {}
