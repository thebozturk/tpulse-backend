import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { EmailService } from '../email/email.service';
import type { TransferAlertItem } from '../email/templates';
import { FavouriteType, NotificationEventType } from '../common/enums';
import { formatFee, playerName } from './digest.formatters';

const LAST_RUN_KEY = 'digest:transfer-alert:lastRunAt';
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // ilk çalışmada son 24 saat
const MAX_TRANSFERS = 500; // tek turda işlenecek üst sınır
const MAX_ITEMS_PER_USER = 5;

/**
 * Transfer & söylenti digest'i: kullanıcının favori takım/oyuncularına dair son
 * transferleri toplar. "Son çalışmadan beri" penceresi Redis'te tutulur.
 * NotificationPreference (Rumour/Transfer) ve emailOptOut'a saygı duyar.
 */
@Injectable()
export class TransferAlertService {
  private readonly logger = new Logger(TransferAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}

  private get webUrl(): string {
    return this.config.getOrThrow<string>('email.webUrl');
  }

  async run(): Promise<void> {
    const runAt = new Date();
    const since = await this.getLastRun(runAt);

    const transfers = await this.prisma.transfer.findMany({
      where: { isDeleted: false, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: MAX_TRANSFERS,
      include: {
        player: { select: { firstName: true, lastName: true } },
        fromTeam: { select: { name: true } },
        toTeam: { select: { name: true } },
      },
    });

    if (transfers.length === 0) {
      await this.setLastRun(runAt);
      return;
    }

    // Transfer → favori hedef indeksleri
    const teamTransfers = new Map<string, string[]>();
    const playerTransfers = new Map<string, string[]>();
    for (const t of transfers) {
      push(teamTransfers, t.fromTeamId, t.id);
      push(teamTransfers, t.toTeamId, t.id);
      push(playerTransfers, t.playerId, t.id);
    }

    const favs = await this.prisma.userFavourite.findMany({
      where: {
        OR: [
          {
            type: FavouriteType.Team,
            targetId: { in: [...teamTransfers.keys()] },
          },
          {
            type: FavouriteType.Player,
            targetId: { in: [...playerTransfers.keys()] },
          },
        ],
      },
      select: { userId: true, type: true, targetId: true },
    });
    if (favs.length === 0) {
      await this.setLastRun(runAt);
      return;
    }

    // userId → eşleşen transfer id'leri
    const byUser = new Map<string, Set<string>>();
    for (const f of favs) {
      const ids =
        f.type === FavouriteType.Team
          ? teamTransfers.get(f.targetId)
          : playerTransfers.get(f.targetId);
      if (!ids) continue;
      let set = byUser.get(f.userId);
      if (!set) {
        set = new Set();
        byUser.set(f.userId, set);
      }
      ids.forEach((id) => set!.add(id));
    }

    const userIds = [...byUser.keys()];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        status: UserStatus.Active,
        isMailConfirm: true,
        emailOptOut: false,
      },
      select: { id: true, email: true, nickname: true },
    });

    // in-app bildirim tercihleri (söylenti vs onaylı ayrı kapatılabilir)
    const outRumour = await this.optedOut(
      userIds,
      NotificationEventType.Rumour,
    );
    const outTransfer = await this.optedOut(
      userIds,
      NotificationEventType.Transfer,
    );
    const transferById = new Map(transfers.map((t) => [t.id, t]));

    let sent = 0;
    for (const user of users) {
      const items: TransferAlertItem[] = [];
      for (const id of byUser.get(user.id) ?? []) {
        const t = transferById.get(id);
        if (!t) continue;
        // pref filtresi: söylenti→Rumour, onaylı→Transfer
        if (t.isRumour ? outRumour.has(user.id) : outTransfer.has(user.id)) {
          continue;
        }
        items.push({
          playerName: playerName(t.player.firstName, t.player.lastName),
          fromTeam: t.fromTeam.name,
          toTeam: t.toTeam.name,
          fee: formatFee(t.feeAmount, t.feeCurrency),
          status: t.isRumour ? 'rumour' : 'confirmed',
          ctaUrl: `${this.webUrl}/transfer/${t.id}`,
        });
        if (items.length >= MAX_ITEMS_PER_USER) break;
      }
      if (items.length === 0) continue;

      try {
        await this.email.sendTransferAlert(user.email, {
          name: user.nickname,
          items,
        });
        sent++;
      } catch (err) {
        this.logger.warn(`Transfer alert gönderilemedi (${user.id}): ${err}`);
      }
    }

    await this.setLastRun(runAt);
    this.logger.log(`Transfer alert digest: ${sent} kullanıcıya gönderildi`);
  }

  /** Belirli eventType için in-app bildirimi kapatmış (enabled=false) kullanıcılar. */
  private async optedOut(
    userIds: string[],
    eventType: number,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, eventType, enabled: false },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  private async getLastRun(now: Date): Promise<Date> {
    const raw = await this.redis.client.get(LAST_RUN_KEY);
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
  }

  private async setLastRun(at: Date): Promise<void> {
    await this.redis.client.set(LAST_RUN_KEY, at.toISOString());
  }
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
