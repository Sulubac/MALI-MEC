import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
@ApiTags('Tasks') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard) @Controller('tasks')
export class TasksController {
  constructor(private s: TasksService) {}
  @Get() findAll(@Query() q: any) { return this.s.findAll(q); }
  @Get('my') getMyTasks(@Request() req: any) { return this.s.getMyTasks(req.user.id); }
  @Get('overdue') getOverdue() { return this.s.getOverdueTasks(); }
  @Post() create(@Body() b: any, @Request() req: any) { return this.s.create(b, req.user.id); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.s.update(id, b); }
}
