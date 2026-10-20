import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalOrder } from '../../entities/rental-order.entity.js';
import { RentalOrderItem } from '../../entities/rental-order-item.entity.js';
import { GearItem } from '../../entities/gear-item.entity.js';
import { Payment } from '../../entities/payment.entity.js';
import { RentalsController } from './rentals.controller.js';
import { RentalsService } from './rentals.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RentalOrder, RentalOrderItem, GearItem, Payment]),
    PaymentsModule,
  ],
  controllers: [RentalsController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
