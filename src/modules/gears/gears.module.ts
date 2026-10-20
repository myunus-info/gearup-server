import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GearItem } from './entities/gear-item.entity.js';
import { GearsController } from './gears.controller.js';
import { GearsService } from './gears.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([GearItem])],
  controllers: [GearsController],
  providers: [GearsService],
  exports: [GearsService],
})
export class GearsModule {}
