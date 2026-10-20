import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../../entities/payment.entity.js';
import { RentalOrder } from '../../entities/rental-order.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SslcommerzService } from './sslcommerz.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, RentalOrder])],
  controllers: [PaymentsController],
  providers: [PaymentsService, SslcommerzService],
  exports: [PaymentsService, SslcommerzService],
})
export class PaymentsModule {}
