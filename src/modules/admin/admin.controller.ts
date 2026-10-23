import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { User } from '../auth/entities/user.entity.js';

@ApiTags('Admin Oversight')
@Controller('admin')
@Auth(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all registered users (Admin)' })
  @ApiResponse({ status: 200, description: 'All users retrieved' })
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return {
      message: 'Users retrieved successfully',
      data: users,
    };
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user status (ACTIVE / SUSPENDED) (Admin)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentUser() admin: User) {
    if (admin.id === id) {
      throw new BadRequestException('Admins cannot change their own status');
    }
    const user = await this.adminService.updateUserStatus(id, dto.status, admin.id);
    return {
      message: 'User status updated successfully',
      data: user,
    };
  }

  @Get('gear')
  @ApiOperation({ summary: 'List all gear listings in platform (Admin)' })
  @ApiResponse({ status: 200, description: 'All gear listings retrieved' })
  async getAllGearListings() {
    const listings = await this.adminService.getAllGearListings();
    return {
      message: 'Gear listings retrieved successfully',
      data: listings,
    };
  }

  @Get('rentals')
  @ApiOperation({ summary: 'List all rental orders platform-wide (Admin)' })
  @ApiResponse({ status: 200, description: 'All rental orders retrieved' })
  async getAllRentalOrders() {
    const rentals = await this.adminService.getAllRentalOrders();
    return {
      message: 'Rental orders retrieved successfully',
      data: rentals,
    };
  }
}
