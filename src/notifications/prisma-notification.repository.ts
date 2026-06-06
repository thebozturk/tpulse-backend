import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { FavouriteType, NotificationEventType } from '../common/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  INotificationRepository,
  PreferenceItem,
  TransferForNotif,
} from './notification.repository';

const EVENT_TYPES = [
  NotificationEventType.Rumour,
  NotificationEventType.Transfer,
];

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(
    userId: string,
    page: number,
    pageSize: number,
    unreadOnly: boolean,
  ): Promise<{ items: Notification[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return count > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return count;
  }

  async getPreferences(userId: string): Promise<PreferenceItem[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const map = new Map(rows.map((r) => [r.eventType, r.enabled]));
    // opt-out modeli: satır yoksa enabled kabul
    return EVENT_TYPES.map((eventType) => ({
      eventType,
      enabled: map.get(eventType) ?? true,
    }));
  }

  async setPreferences(userId: string, prefs: PreferenceItem[]): Promise<void> {
    await this.prisma.$transaction(
      prefs.map((p) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_eventType: { userId, eventType: p.eventType } },
          create: { userId, eventType: p.eventType, enabled: p.enabled },
          update: { enabled: p.enabled },
        }),
      ),
    );
  }

  async getTransfer(transferId: string): Promise<TransferForNotif | null> {
    const t = await this.prisma.transfer.findFirst({
      where: { id: transferId },
      include: {
        player: { select: { firstName: true, lastName: true } },
        fromTeam: { select: { name: true, leagueId: true } },
        toTeam: { select: { name: true, leagueId: true } },
      },
    });
    if (!t) {
      return null;
    }
    return {
      id: t.id,
      playerId: t.playerId,
      fromTeamId: t.fromTeamId,
      toTeamId: t.toTeamId,
      createdByUserId: t.createdByUserId,
      isRumour: t.isRumour,
      playerName: `${t.player.firstName} ${t.player.lastName}`,
      fromTeamName: t.fromTeam.name,
      toTeamName: t.toTeam.name,
      fromLeagueId: t.fromTeam.leagueId,
      toLeagueId: t.toTeam.leagueId,
    };
  }

  async findFavouriteUserIds(
    playerId: string,
    teamIds: string[],
    leagueIds: string[],
    reporterId: string | null,
  ): Promise<string[]> {
    const or: Prisma.UserFavouriteWhereInput[] = [
      { type: FavouriteType.Player, targetId: playerId },
      { type: FavouriteType.Team, targetId: { in: teamIds } },
      { type: FavouriteType.League, targetId: { in: leagueIds } },
    ];
    if (reporterId) {
      or.push({ type: FavouriteType.Reporter, targetId: reporterId });
    }
    const favs = await this.prisma.userFavourite.findMany({
      where: { OR: or },
      select: { userId: true },
      distinct: ['userId'],
    });
    return favs.map((f) => f.userId);
  }

  async getOptedOutUserIds(
    userIds: string[],
    eventType: number,
  ): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, eventType, enabled: false },
      select: { userId: true },
    });
    return new Set(prefs.map((p) => p.userId));
  }

  async createNotification(
    userId: string,
    eventType: number,
    title: string,
    body: string,
    transferId: string,
  ): Promise<boolean> {
    try {
      await this.prisma.notification.create({
        data: { userId, eventType, title, body, transferId },
      });
      return true;
    } catch (e) {
      // dedup unique (userId, transferId, eventType)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return false;
      }
      throw e;
    }
  }
}
