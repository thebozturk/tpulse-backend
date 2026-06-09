import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { WeeklyTopTransfer } from '../email/templates';
import { formatFee, playerName, rankPercentile } from './digest.formatters';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RECIPIENT_PAGE = 500;
const TOP_TRANSFER_COUNT = 3;

/** Yalnız aktif + doğrulanmış + opt-in kullanıcılar digest alır. */
const ELIGIBLE = {
  status: UserStatus.Active,
  isMailConfirm: true,
  emailOptOut: false,
} as const;

/**
 * Haftalık özet digest'i: Pulse Score + global sıralama + haftanın öne çıkan
 * transferleri. Cron ile tetiklenir (DigestSchedulerService).
 */
@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private get webUrl(): string {
    return this.config.getOrThrow<string>('email.webUrl');
  }

  async run(): Promise<void> {
    const since = new Date(Date.now() - WEEK_MS);
    const topTransfers = await this.loadTopTransfers(since);
    const { rankOf, total } = await this.loadRanks();
    const ctaUrl = `${this.webUrl}/haftalik-ozet`;

    let sent = 0;
    let skip = 0;
    for (;;) {
      const batch = await this.prisma.user.findMany({
        where: ELIGIBLE,
        select: {
          id: true,
          email: true,
          nickname: true,
          reputationScore: true,
        },
        orderBy: { id: 'asc' },
        skip,
        take: RECIPIENT_PAGE,
      });
      if (batch.length === 0) break;

      for (const user of batch) {
        const rank = rankOf.get(user.id) ?? total;
        try {
          await this.email.sendWeeklyDigest(user.email, {
            name: user.nickname,
            pulseScore: user.reputationScore,
            globalRank: rank,
            rankPercentile: rankPercentile(rank, total),
            topTransfers,
            ctaUrl,
          });
          sent++;
        } catch (err) {
          this.logger.warn(
            `Haftalık digest gönderilemedi (${user.id}): ${err}`,
          );
        }
      }

      skip += batch.length;
      if (batch.length < RECIPIENT_PAGE) break;
    }

    this.logger.log(`Haftalık digest: ${sent} kullanıcıya gönderildi`);
  }

  /** Tüm kullanıcıları reputationScore'a göre sıralayıp userId→rank haritası kurar. */
  private async loadRanks(): Promise<{
    rankOf: Map<string, number>;
    total: number;
  }> {
    const all = await this.prisma.user.findMany({
      select: { id: true },
      orderBy: { reputationScore: 'desc' },
    });
    const rankOf = new Map<string, number>();
    all.forEach((u, i) => rankOf.set(u.id, i + 1));
    return { rankOf, total: all.length };
  }

  /** Son 7 günün en yüksek bonservisli onaylı transferleri. */
  private async loadTopTransfers(since: Date): Promise<WeeklyTopTransfer[]> {
    const rows = await this.prisma.transfer.findMany({
      where: {
        isDeleted: false,
        isRumour: false,
        transferDate: { gte: since },
      },
      orderBy: { feeAmount: 'desc' },
      take: TOP_TRANSFER_COUNT,
      include: {
        player: { select: { firstName: true, lastName: true } },
        fromTeam: { select: { name: true } },
        toTeam: { select: { name: true } },
      },
    });
    return rows.map((t) => ({
      playerName: playerName(t.player.firstName, t.player.lastName),
      fromTeam: t.fromTeam.name,
      toTeam: t.toTeam.name,
      fee: formatFee(t.feeAmount, t.feeCurrency),
    }));
  }
}
