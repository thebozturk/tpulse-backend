import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { ListResponse } from '../common/interfaces/response.interface';
import { PreferenceDto, SetPreferencesDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('me-notifications')
@ApiBearerAuth()
@Controller('api/me/notification-preferences')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class MeNotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirim tercihleri' })
  async get(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<PreferenceDto>> {
    return { items: await this.notifications.getPreferences(user.userId) };
  }

  @Put()
  @ApiOperation({ summary: 'Bildirim tercihlerini güncelle' })
  async set(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetPreferencesDto,
  ): Promise<ListResponse<PreferenceDto>> {
    return {
      items: await this.notifications.setPreferences(
        user.userId,
        dto.preferences,
      ),
    };
  }
}
