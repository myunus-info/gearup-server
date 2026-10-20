import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Review, RentalOrder])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
