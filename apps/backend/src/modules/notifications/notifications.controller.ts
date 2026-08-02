import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get() @ApiOperation({ summary: 'Get user notifications' })
  getNotifications(@CurrentUser('id') userId: string, @Query('unreadOnly') unreadOnly: boolean) {
    return this.notificationsService.getUserNotifications(userId, unreadOnly);
  }

  @Get('unread-count') @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read') @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string) { return this.notificationsService.markAsRead(id); }

  @Patch('read-all') @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser('id') userId: string) { return this.notificationsService.markAllAsRead(userId); }
}
