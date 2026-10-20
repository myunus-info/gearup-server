import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../../entities/user.entity.js';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Auth(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Leave a rating and review for a returned gear item' })
  @ApiResponse({ status: 201, description: 'Review submitted successfully' })
  async createReview(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: User,
  ) {
    const review = await this.reviewsService.createReview(dto, user.id);
    return {
      message: 'Review created successfully',
      data: review,
    };
  }

  @Get('gear/:gearItemId')
  @ApiOperation({ summary: 'Get all reviews for a gear item' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getReviewsForGear(@Param('gearItemId') gearItemId: string) {
    const reviews = await this.reviewsService.getReviewsForGear(gearItemId);
    return {
      message: 'Reviews retrieved successfully',
      data: reviews,
    };
  }
}
