import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity.js';
import { GearItem } from '../../entities/gear-item.entity.js';
import { RentalOrder } from '../../entities/rental-order.entity.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, GearItem, RentalOrder])],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
