import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
@ApiTags('Properties') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard) @Controller('properties')
export class PropertiesController {
  constructor(private s: PropertiesService) {}
  @Get() findAll(@Query() q: any) { return this.s.findAll(q); }
  @Get('search') search(@Query('q') q: string) { return this.s.search(q); }
  @Get(':id') findOne(@Param('id') id: string) { return this.s.findOne(id); }
  @Post() create(@Body() body: any) { return this.s.create(body); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.s.update(id, b); }
  @Post(':id/owners') addOwner(@Param('id') id: string, @Body() b: any) { return this.s.addOwner(id, b.clientId, b.sharePercent); }
}
