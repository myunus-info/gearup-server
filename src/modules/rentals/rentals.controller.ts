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
import { RentalsService } from './rentals.service.js';
import { CreateRentalDto } from './dto/create-rental.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../../entities/user.entity.js';

@ApiTags('Rentals (Orders)')
@Controller('rentals')
@Auth(Role.CUSTOMER)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new rental order & initiate payment session' })
  @ApiResponse({ status: 201, description: 'Rental order placed successfully' })
  async createRentalOrder(
    @Body() dto: CreateRentalDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.rentalsService.createRentalOrder(dto, user);
    return {
      message: 'Rental order placed successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List customer rental orders' })
  @ApiResponse({ status: 200, description: 'Customer rental orders retrieved' })
  async getMyRentalOrders(@CurrentUser() user: User) {
    const orders = await this.rentalsService.getMyRentalOrders(user.id);
    return {
      message: 'Rental orders retrieved successfully',
      data: orders,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rental order details by ID' })
  @ApiResponse({ status: 200, description: 'Rental order retrieved' })
  async getRentalOrderById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.rentalsService.getRentalOrderById(id, user.id);
    return {
      message: 'Rental order retrieved successfully',
      data: order,
    };
  }
}
