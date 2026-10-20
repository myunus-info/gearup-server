import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GearItem } from '../../entities/gear-item.entity.js';
import { Category } from '../../entities/category.entity.js';
import { RentalOrder } from '../../entities/rental-order.entity.js';
import { ProviderController } from './provider.controller.js';
import { ProviderService } from './provider.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([GearItem, Category, RentalOrder])],
  controllers: [ProviderController],
  providers: [ProviderService],
  exports: [ProviderService],
})
export class ProviderModule {}
