import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { CreateReviewDto } from './dto/create-review.dto.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
  ) {}

  async createReview(dto: CreateReviewDto, customerId: string): Promise<Review> {
    const order = await this.rentalOrderRepository.findOne({
      where: { id: dto.rentalOrderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('Not your order!');
    }

    if (order.status === RentalStatus.CANCELLED) {
      throw new BadRequestException('You cannot review a cancelled rental order');
    }

    if (order.status !== RentalStatus.RETURNED) {
      throw new BadRequestException('You can only review gear after the rental has been returned');
    }

    const rentedThisGear = order.items.some(item => item.gearItemId === dto.gearItemId);

    if (!rentedThisGear) {
      throw new BadRequestException('This gear item was not part of the specified rental order');
    }

    const existing = await this.reviewRepository.findOne({
      where: {
        customerId,
        gearItemId: dto.gearItemId,
        rentalOrderId: dto.rentalOrderId,
      },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this gear item for this rental order');
    }

    const review = this.reviewRepository.create({
      customerId,
      gearItemId: dto.gearItemId,
      rentalOrderId: dto.rentalOrderId,
      rating: dto.rating,
      comment: dto.comment,
    });

    return this.reviewRepository.save(review);
  }

  async getReviewsForGear(gearItemId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { gearItemId },
      relations: { customer: true },
      order: { createdAt: 'DESC' },
    });
  }
}
