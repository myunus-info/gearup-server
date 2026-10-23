import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
}
