import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'List all users' })
  findAll(@Query() query: any) { return this.usersService.findAll(query); }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'Get user statistics' })
  getStats() { return this.usersService.getStats(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'Create new user' })
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.usersService.update(id, dto); }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'Update user status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.usersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string) { return this.usersService.remove(id); }
}
