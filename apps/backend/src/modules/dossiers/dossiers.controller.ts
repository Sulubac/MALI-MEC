import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DossiersService } from './dossiers.service';
import { CreateDossierDto, UpdateDossierDto, AddClientToDossierDto } from './dto/create-dossier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dossiers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Get()
  @ApiOperation({ summary: 'List all dossiers' })
  findAll(@Query() query: any) { return this.dossiersService.findAll(query); }

  @Get('stats')
  @ApiOperation({ summary: 'Dossier statistics' })
  getStats() { return this.dossiersService.getStats(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get dossier details' })
  findOne(@Param('id') id: string) { return this.dossiersService.findOne(id); }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get dossier timeline' })
  getTimeline(@Param('id') id: string) { return this.dossiersService.getTimeline(id); }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get dossier comments' })
  getComments(@Param('id') id: string) { return this.dossiersService.getComments(id); }

  @Post()
  @ApiOperation({ summary: 'Create new dossier' })
  create(@Body() dto: CreateDossierDto, @CurrentUser('id') userId: string) {
    return this.dossiersService.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update dossier' })
  update(@Param('id') id: string, @Body() dto: UpdateDossierDto, @CurrentUser('id') userId: string) {
    return this.dossiersService.update(id, dto, userId);
  }

  @Post(':id/clients')
  @ApiOperation({ summary: 'Add client to dossier' })
  addClient(@Param('id') id: string, @Body() dto: AddClientToDossierDto) {
    return this.dossiersService.addClient(id, dto);
  }

  @Delete(':id/clients/:clientId')
  @ApiOperation({ summary: 'Remove client from dossier' })
  removeClient(@Param('id') id: string, @Param('clientId') clientId: string) {
    return this.dossiersService.removeClient(id, clientId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to dossier' })
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string; isInternal?: boolean },
    @CurrentUser('id') userId: string,
  ) {
    return this.dossiersService.addComment(id, body.content, userId, body.isInternal);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive dossier' })
  archive(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.dossiersService.archive(id, userId);
  }
}
