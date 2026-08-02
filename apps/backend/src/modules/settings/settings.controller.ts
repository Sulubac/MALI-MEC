import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Settings')
@ApiBearerAuth('JWT')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public settings' })
  getPublic() { return this.settingsService.getPublicSettings(); }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  getAll() { return this.settingsService.getAllSettings(); }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Update settings' })
  update(@Body() body: Array<{ key: string; value: string; category: string }>) {
    return this.settingsService.bulkUpdate(body);
  }
}
