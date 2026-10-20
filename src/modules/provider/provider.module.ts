import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GearItem } from '../gears/entities/gear-item.entity.js';
import { Category } from '../categories/entities/category.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { ProviderController } from './provider.controller.js';
import { ProviderService } from './provider.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([GearItem, Category, RentalOrder])],
  controllers: [ProviderController],
  providers: [ProviderService],
  exports: [ProviderService],
})
export class ProviderModule {}
