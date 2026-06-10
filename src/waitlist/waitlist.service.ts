import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { LaunchCampaign } from '@prisma/client';
import { Queue } from 'bullmq';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { LaunchCampaignDto } from './dto/launch-campaign.dto';
import { LaunchCampaignResponseDto } from './dto/launch-campaign.response.dto';
import { WaitlistStatsResponseDto } from './dto/waitlist-stats.response.dto';
import { LAUNCH_QUEUE, LaunchJobData } from './waitlist.constants';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(LAUNCH_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Landing page kaydı — e-posta bazında idempotent upsert. Var olan e-posta
   * tekrar gönderilirse yeni kayıt yaratılmaz, sayaç şişmez.
   */
  async subscribe(dto: CreateWaitlistDto): Promise<void> {
    // Honeypot dolu → bot. Hata dönme (ipucu verme), sessizce yok say.
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(
        `Waitlist honeypot tetiklendi, yok sayıldı: ${dto.email}`,
      );
      return;
    }
    await this.prisma.waitlistSubscriber.upsert({
      where: { email: dto.email },
      create: { email: dto.email, source: dto.source ?? null },
      update: {},
    });
    this.logger.log(`Waitlist kaydı alındı: ${dto.email}`);
  }

  /**
   * Lansman kampanyasını oluşturur ve işlenmek üzere kuyruğa atar
   * (senkron gönderim yok). total = o anki aktif abone sayısı.
   */
  async enqueueLaunch(
    createdBy: string,
    dto: LaunchCampaignDto,
  ): Promise<LaunchCampaignResponseDto> {
    const total = await this.prisma.waitlistSubscriber.count({
      where: { status: 'subscribed', launchEmailSentAt: null },
    });
    const campaign = await this.prisma.launchCampaign.create({
      data: {
        subject: dto.subject,
        body: dto.body,
        ctaLabel: dto.ctaLabel ?? null,
        ctaUrl: dto.ctaUrl ?? null,
        total,
        createdBy,
      },
    });
    await this.queue.add(
      'launch',
      { campaignId: campaign.id } satisfies LaunchJobData,
      { attempts: 3, removeOnComplete: true },
    );
    this.logger.log(
      `Lansman kampanyası kuyruğa alındı: ${campaign.id} (${total} alıcı)`,
    );
    return toLaunchResponse(campaign);
  }

  /** Kampanya geçmişi (paged). */
  async history(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<LaunchCampaignResponseDto>> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, totalCount] = await Promise.all([
      this.prisma.launchCampaign.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.launchCampaign.count(),
    ]);
    return buildPaged(items.map(toLaunchResponse), totalCount, page, pageSize);
  }

  /** Waitlist özet sayıları (panel kartı için). */
  async stats(): Promise<WaitlistStatsResponseDto> {
    const [total, subscribed, unsubscribed, launchSent] = await Promise.all([
      this.prisma.waitlistSubscriber.count(),
      this.prisma.waitlistSubscriber.count({ where: { status: 'subscribed' } }),
      this.prisma.waitlistSubscriber.count({
        where: { status: 'unsubscribed' },
      }),
      this.prisma.waitlistSubscriber.count({
        where: { launchEmailSentAt: { not: null } },
      }),
    ]);
    return { total, subscribed, unsubscribed, launchSent };
  }
}

export function toLaunchResponse(c: LaunchCampaign): LaunchCampaignResponseDto {
  return {
    id: c.id,
    subject: c.subject,
    body: c.body,
    ctaLabel: c.ctaLabel ?? undefined,
    ctaUrl: c.ctaUrl ?? undefined,
    status: c.status,
    total: c.total,
    sentCount: c.sentCount,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
  };
}
