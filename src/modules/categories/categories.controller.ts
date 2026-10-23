import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { Role } from '../../common/enums/role.enum.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Auth(Role.PROVIDER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category (Provider only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.categoriesService.create(dto);
    return {
      message: 'Category created successfully',
      data: category,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all categories (Public)' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories(@Query('id') id?: string) {
    const categories = await this.categoriesService.findAll(id);
    return {
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }
}
