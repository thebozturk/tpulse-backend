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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import {
  CountResponseDto,
  SuccessResponseDto,
} from '../common/dto/common-response.dto';
import { NotificationDto, NotificationQueryDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('me-notifications')
@ApiBearerAuth()
@Controller('api/me/notifications')
@Throttle(ThrottlePolicies.write)
export class MeNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirimlerim (paged)' })
  @ApiPagedResponse(NotificationDto)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationQueryDto,
  ): Promise<PagedResult<NotificationDto>> {
    return this.notifications.getForUser(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamış sayısı' })
  @ApiResponse({ status: 200, type: CountResponseDto })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.userId) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tümünü okundu işaretle' })
  @ApiSingleResponse(CountResponseDto)
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
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.notifications.markRead(user.userId, id);
    return { success: true };
  }
}
