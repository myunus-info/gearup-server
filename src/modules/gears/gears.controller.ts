import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GearsService } from './gears.service.js';
import { QueryGearDto } from './dto/query-gear.dto.js';

@ApiTags('Gears (Public Catalog)')
@Controller('gears')
export class GearsController {
  constructor(private readonly gearsService: GearsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse and search public gear listings' })
  @ApiResponse({ status: 200, description: 'List of gear items with pagination' })
  async getAllGears(@Query() query: QueryGearDto) {
    const result = await this.gearsService.findAll(query);
    return {
      message: 'Gears retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single gear item details by ID' })
  @ApiResponse({ status: 200, description: 'Gear item details retrieved' })
  async getGearById(@Param('id') id: string) {
    const gear = await this.gearsService.findById(id);
    return {
      message: 'Gear item retrieved successfully',
      data: gear,
    };
  }
}
