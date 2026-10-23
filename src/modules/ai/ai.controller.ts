import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { ChatRequestDto } from './dto/chat-request.dto.js';

@ApiTags('AI Concierge')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'AI Adventure Concierge - Process natural language advice & recommend in-stock gear',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversational response with matching in-stock equipment',
  })
  async chat(@Body() dto: ChatRequestDto) {
    return this.aiService.chat(dto);
  }

  @Get('search-suggestions')
  @ApiOperation({
    summary:
      'AI Smart Search Suggestions - Query popular equipment and direct product matches',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching search terms and live equipment matches',
  })
  async searchSuggestions(@Query('q') q = '') {
    return this.aiService.getSearchSuggestions(q);
  }
}
