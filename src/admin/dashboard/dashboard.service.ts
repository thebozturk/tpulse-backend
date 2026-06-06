import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.response.dto';

/**
 * Back office dashboard metrikleri. Ağır count sorguları kısa TTL ile Redis'te cache'lenir.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private static readonly CACHE_KEY = 'dashboard:overview';
  private static readonly CACHE_TTL_SECONDS = 90;
  private static readonly RECENT_LIMIT = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(): Promise<DashboardOverviewResponseDto> {
    const cached = await this.readCache();
    if (cached) {
      return cached;
    }
    const overview = await this.computeOverview();
    await this.writeCache(overview);
    return overview;
  }

  private async computeOverview(): Promise<DashboardOverviewResponseDto> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      newThisWeek,
      transfers,
      rumours,
      news,
      posts,
      comments,
      recentPosts,
      postAuthorsToday,
      commentAuthorsToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.transfer.count({
        where: { isDeleted: false, isRumour: false },
      }),
      this.prisma.transfer.count({
        where: { isDeleted: false, isRumour: true },
      }),
      this.prisma.news.count(),
      this.prisma.post.count(),
      this.prisma.comment.count(),
      this.prisma.post.findMany({
        orderBy: { createdAtUtc: 'desc' },
        take: DashboardService.RECENT_LIMIT,
        select: { id: true, content: true, createdAtUtc: true },
      }),
      // lastLoginAt alanı yok → aktiflik, bugün içerik üreten benzersiz kullanıcı ile proxy'lenir.
      this.prisma.post.findMany({
        where: { createdAtUtc: { gte: startOfToday } },
        distinct: ['ownerId'],
        select: { ownerId: true },
      }),
      this.prisma.comment.findMany({
        where: { createdAtUtc: { gte: startOfToday } },
        distinct: ['ownerId'],
        select: { ownerId: true },
      }),
    ]);

    const activeToday = new Set<string>([
      ...postAuthorsToday.map((p) => p.ownerId),
      ...commentAuthorsToday.map((c) => c.ownerId),
    ]).size;

    const recent = recentPosts.map((p) => ({
      type: 'post',
      id: p.id,
      label: p.content.slice(0, 80),
      createdAt: p.createdAtUtc,
    }));

    return {
      users: { total: usersTotal, activeToday, newThisWeek },
      content: { transfers, rumours, news, posts, comments },
      moderation: { pendingReports: 0 },
      recent,
    };
  }

  private async readCache(): Promise<DashboardOverviewResponseDto | null> {
    try {
      const raw = await this.redis.client.get(DashboardService.CACHE_KEY);
      if (raw) {
        return JSON.parse(raw) as DashboardOverviewResponseDto;
      }
    } catch (err) {
      this.logger.warn(`Dashboard cache okuma hatası: ${String(err)}`);
    }
    return null;
  }

  private async writeCache(
    overview: DashboardOverviewResponseDto,
  ): Promise<void> {
    try {
      await this.redis.client.set(
        DashboardService.CACHE_KEY,
        JSON.stringify(overview),
        'EX',
        DashboardService.CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Dashboard cache yazma hatası: ${String(err)}`);
    }
  }
}
