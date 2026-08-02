import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
@ApiTags('Appointments') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard) @Controller('appointments')
export class AppointmentsController {
  constructor(private s: AppointmentsService) {}
  @Get() findAll(@Query() q: any) { return this.s.findAll(q); }
  @Get('today') getToday(@Query('notaryId') id?: string) { return this.s.getTodayAppointments(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.s.findOne(id); }
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.s.update(id, b); }
  @Patch(':id/cancel') cancel(@Param('id') id: string) { return this.s.cancel(id); }
}
