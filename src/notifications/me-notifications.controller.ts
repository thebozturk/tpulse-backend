import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { NotificationDto, NotificationQueryDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('me-notifications')
@ApiBearerAuth()
@Controller('api/me/notifications')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class MeNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirimlerim (paged)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationQueryDto,
  ): Promise<PagedResult<NotificationDto>> {
    return this.notifications.getForUser(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamış sayısı' })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.userId) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tümünü okundu işaretle' })
  async readAll(
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<{ count: number }>> {
    return {
      data: { count: await this.notifications.markAllRead(user.userId) },
    };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bildirimi okundu işaretle' })
  async read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.notifications.markRead(user.userId, id);
    return { success: true };
  }
}
