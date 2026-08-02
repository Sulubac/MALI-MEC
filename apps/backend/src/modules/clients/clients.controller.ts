import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Clients')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List clients with pagination and search' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) { return this.clientsService.findAll(query); }

  @Get('stats')
  @ApiOperation({ summary: 'Client statistics' })
  getStats() { return this.clientsService.getStats(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get client details' })
  findOne(@Param('id') id: string) { return this.clientsService.findOne(id); }

  @Get(':id/dossiers')
  @ApiOperation({ summary: 'Get client dossiers' })
  getDossiers(@Param('id') id: string) { return this.clientsService.getDossiers(id); }

  @Post()
  @ApiOperation({ summary: 'Create new client' })
  create(@Body() dto: CreateClientDto) { return this.clientsService.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) { return this.clientsService.update(id, dto); }

  @Patch(':id/kyc')
  @ApiOperation({ summary: 'Update KYC status' })
  updateKyc(@Param('id') id: string, @Body('status') status: string) { return this.clientsService.updateKyc(id, status); }

  @Patch(':id/risk')
  @ApiOperation({ summary: 'Update risk assessment' })
  updateRisk(@Param('id') id: string, @Body() body: { riskScore: number; riskLevel: string }) {
    return this.clientsService.updateRisk(id, body.riskScore, body.riskLevel);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate client' })
  remove(@Param('id') id: string) { return this.clientsService.remove(id); }
}
