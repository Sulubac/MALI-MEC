import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto, SearchLegalDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI legal assistant' })
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto.message, dto.context, dto.history);
  }

  @Post('documents/:id/review')
  @ApiOperation({ summary: 'AI review of document' })
  reviewDocument(@Param('id') id: string, @Body('context') context: string) {
    return this.aiService.reviewDocument(id, context);
  }

  @Post('dossiers/:id/risk-assessment')
  @ApiOperation({ summary: 'AI risk assessment for dossier' })
  assessRisk(@Param('id') id: string) {
    return this.aiService.assessDossierRisk(id);
  }

  @Post('dossiers/:id/summarize')
  @ApiOperation({ summary: 'Generate AI summary for dossier' })
  summarize(@Param('id') id: string) {
    return this.aiService.summarizeDossier(id);
  }

  @Get('legal/search')
  @ApiOperation({ summary: 'Search Djiboutian legal knowledge base' })
  searchLegal(@Query() query: SearchLegalDto) {
    return this.aiService.searchLegalKnowledge(query.query, query.category, query.language);
  }

  @Post('documents/:id/ocr')
  @ApiOperation({ summary: 'Extract text from document via OCR' })
  extractOcr(@Param('id') id: string) {
    return this.aiService.extractOcr(id);
  }
}
