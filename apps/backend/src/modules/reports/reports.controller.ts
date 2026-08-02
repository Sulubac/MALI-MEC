import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard') @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboard() { return this.reportsService.getDashboardStats(); }

  @Get('monthly') @ApiOperation({ summary: 'Get monthly report' })
  getMonthly(@Query('year') year: number, @Query('month') month: number) {
    return this.reportsService.getMonthlyReport(year || new Date().getFullYear(), month || new Date().getMonth() + 1);
  }

  @Get('activity') @ApiOperation({ summary: 'Get activity feed' })
  getActivity(@Query('limit') limit: number) { return this.reportsService.getActivityFeed(limit); }
}
