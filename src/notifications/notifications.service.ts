import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { NotificationEventType } from '../common/enums';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import {
  NotificationDto,
  NotificationQueryDto,
  PreferenceDto,
} from './dto/notification.dto';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY,
} from './notification.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: INotificationRepository,
  ) {}

  async getForUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PagedResult<NotificationDto>> {
    const { items, total } = await this.repo.getForUser(
      userId,
      query.page,
      query.pageSize,
      query.unreadOnly,
    );
    return buildPaged(items.map(toDto), total, query.page, query.pageSize);
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.getUnreadCount(userId);
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!(await this.repo.markRead(userId, id))) {
      throw new NotFoundException('Bildirim bulunamadı');
    }
  }

  markAllRead(userId: string): Promise<number> {
    return this.repo.markAllRead(userId);
  }

  getPreferences(userId: string): Promise<PreferenceDto[]> {
    return this.repo.getPreferences(userId);
  }

  async setPreferences(
    userId: string,
    prefs: PreferenceDto[],
  ): Promise<PreferenceDto[]> {
    await this.repo.setPreferences(userId, prefs);
    return this.repo.getPreferences(userId);
  }

  /** Transfer/rumour oluşunca favori eşleşen kullanıcılara bildirim (dedup + opt-out). */
  async generateForTransfer(transferId: string): Promise<number> {
    const t = await this.repo.getTransfer(transferId);
    if (!t) {
      return 0;
    }
    const eventType = t.isRumour
      ? NotificationEventType.Rumour
      : NotificationEventType.Transfer;

    const userIds = (
      await this.repo.findFavouriteUserIds(
        t.playerId,
        [t.fromTeamId, t.toTeamId],
        [t.fromLeagueId, t.toLeagueId],
        t.createdByUserId,
      )
    ).filter((u) => u !== t.createdByUserId);

    if (userIds.length === 0) {
      return 0;
    }
    const optedOut = await this.repo.getOptedOutUserIds(userIds, eventType);

    const title = t.isRumour ? 'Yeni söylenti' : 'Yeni transfer';
    const body = `${t.playerName}: ${t.fromTeamName} → ${t.toTeamName}`;

    let created = 0;
    for (const userId of userIds) {
      if (optedOut.has(userId)) {
        continue;
      }
      if (
        await this.repo.createNotification(userId, eventType, title, body, t.id)
      ) {
        created++;
      }
    }
    return created;
  }
}

function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    eventType: n.eventType,
    title: n.title,
    body: n.body,
    transferId: n.transferId ?? undefined,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}
