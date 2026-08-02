import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents' })
  findAll(@Query() query: any) { return this.documentsService.findAll(query); }

  @Get('stats')
  @ApiOperation({ summary: 'Document statistics' })
  getStats() { return this.documentsService.getStats(); }

  @Get('templates')
  @ApiOperation({ summary: 'List document templates' })
  getTemplates(@Query('type') type: string) { return this.documentsService.getTemplates(type); }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details' })
  findOne(@Param('id') id: string) { return this.documentsService.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create new document' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser('id') userId: string) {
    return this.documentsService.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Post(':id/version')
  @ApiOperation({ summary: 'Create new version' })
  createVersion(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.createVersion(id, userId);
  }

  @Post(':id/request-signature')
  @ApiOperation({ summary: 'Request signatures' })
  requestSignature(@Param('id') id: string, @Body('signerIds') signerIds: string[]) {
    return this.documentsService.requestSignature(id, signerIds);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign document' })
  sign(@Param('id') id: string, @CurrentUser('id') userId: string, @Body('signatureData') signatureData: string) {
    return this.documentsService.sign(id, userId, signatureData);
  }

  @Post('generate-from-template')
  @ApiOperation({ summary: 'Generate document from template' })
  generateFromTemplate(
    @Body() body: { templateId: string; variables: Record<string, string>; dossierId: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.generateFromTemplate(
      body.templateId, body.variables, body.dossierId, userId,
    );
  }
}
