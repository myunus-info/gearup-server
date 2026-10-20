import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProviderService } from './provider.service.js';
import { CreateGearDto } from './dto/create-gear.dto.js';
import { UpdateGearDto } from './dto/update-gear.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../../entities/user.entity.js';

@ApiTags('Provider Dashboard')
@Controller('provider')
@Auth(Role.PROVIDER)
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Post('gear')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new gear listing (Provider)' })
  @ApiResponse({ status: 201, description: 'Gear item created successfully' })
  async addGear(@Body() dto: CreateGearDto, @CurrentUser() user: User) {
    const gear = await this.providerService.addGear(dto, user.id);
    return {
      message: 'Gear item added successfully',
      data: gear,
    };
  }

  @Get('gear')
  @ApiOperation({ summary: 'List all own gear listings (Provider)' })
  @ApiResponse({ status: 200, description: 'Provider gear items retrieved' })
  async getMyGears(@CurrentUser() user: User) {
    const gears = await this.providerService.getMyGears(user.id);
    return {
      message: 'Gear items retrieved successfully',
      data: gears,
    };
  }

  @Get('gear/:id')
  @ApiOperation({ summary: 'Get single own gear item by ID (Provider)' })
  async getGearById(@Param('id') id: string, @CurrentUser() user: User) {
    const gear = await this.providerService.getGearById(id, user.id);
    return {
      message: 'Gear item retrieved successfully',
      data: gear,
    };
  }

  @Put('gear/:id')
  @ApiOperation({ summary: 'Update own gear item (Provider)' })
  async updateGear(
    @Param('id') id: string,
    @Body() dto: UpdateGearDto,
    @CurrentUser() user: User,
  ) {
    const gear = await this.providerService.updateGear(id, dto, user.id);
    return {
      message: 'Gear item updated successfully',
      data: gear,
    };
  }

  @Patch('gear/:id')
  @ApiOperation({ summary: 'Partially update own gear item (Provider)' })
  async patchGear(
    @Param('id') id: string,
    @Body() dto: UpdateGearDto,
    @CurrentUser() user: User,
  ) {
    const gear = await this.providerService.updateGear(id, dto, user.id);
    return {
      message: 'Gear item updated successfully',
      data: gear,
    };
  }

  @Delete('gear/:id')
  @ApiOperation({ summary: 'Delete own gear item (Provider)' })
  async deleteGear(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.providerService.deleteGear(id, user.id);
    return {
      message: 'Gear item deleted successfully',
      data: result,
    };
  }

  @Get('orders')
  @ApiOperation({ summary: 'List customer rental orders containing provider gear' })
  async getProviderOrders(@CurrentUser() user: User) {
    const orders = await this.providerService.getProviderOrders(user.id);
    return {
      message: 'Provider orders retrieved successfully',
      data: orders,
    };
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Update rental order status (Provider)' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    const updated = await this.providerService.updateOrderStatus(
      id,
      dto.status,
      user.id,
    );
    return {
      message: 'Order status updated successfully',
      data: updated,
    };
  }
}
