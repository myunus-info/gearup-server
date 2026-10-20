import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity.js';
import { GearItem } from '../gears/entities/gear-item.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, GearItem, RentalOrder])],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
