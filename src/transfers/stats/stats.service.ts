import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheTag, CacheTtl } from '../../common/redis/cache-tags';
import { CacheService } from '../../common/redis/cache.service';
import { TeamTransferLineDto } from '../dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfer.mapper';
import { TransferWithRel } from '../transfer.repository';
import { CurrencyConverter } from './currency-converter';
import { PeriodSummaryQueryDto } from './dto/stats-query.dto';
import { PeriodsQueryDto } from './dto/stats-query.dto';
import { SeasonDashboardQueryDto, StatsFilterDto } from './dto/stats-query.dto';
import { TransferPeriodSummaryDto } from './dto/period-summary.dto';
import { TransferPeriodDto } from './dto/transfer-period.dto';
import { TransferSeasonDashboardDto } from './dto/season-dashboard.dto';
import { TransferStatsDto } from './dto/transfer-stats.dto';
import { IStatsRepository, STATS_REPOSITORY } from './stats.repository';

interface Range {
  start: Date;
  end: Date;
}

@Injectable()
export class StatsService {
  constructor(
    @Inject(STATS_REPOSITORY) private readonly repo: IStatsRepository,
    private readonly currency: CurrencyConverter,
    private readonly cache: CacheService,
  ) {}

  async getStats(filter: StatsFilterDto): Promise<TransferStatsDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:stats', { ...filter }),
      CacheTtl.List,
      () => this.computeStats(filter),
      [CacheTag.Transfers],
    );
  }

  private async computeStats(
    filter: StatsFilterDto,
  ): Promise<TransferStatsDto> {
    const where = await this.buildWhere(filter);
    const [agg, mostExpensive, latest, earliest, buyer, seller, player] =
      await Promise.all([
        this.repo.aggregate(where),
        this.repo.topByFee(where),
        this.repo.edge(where, 'desc'),
        this.repo.edge(where, 'asc'),
        this.repo.mostActiveTeam(where, 'buyer'),
        this.repo.mostActiveTeam(where, 'seller'),
        this.repo.mostTransferredPlayer(where),
      ]);

    return {
      totalTransfers: agg.totalTransfers,
      totalSpent: agg.totalSpent,
      averageFee: agg.averageFee,
      maxFee: agg.maxFee,
      minFee: agg.minFee,
      mostExpensiveTransfer: mostExpensive
        ? toTeamTransferLine(mostExpensive)
        : undefined,
      latestTransfer: latest ? toTeamTransferLine(latest) : undefined,
      earliestTransfer: earliest ? toTeamTransferLine(earliest) : undefined,
      mostActiveBuyerTeam: buyer ?? undefined,
      mostActiveSellerTeam: seller ?? undefined,
      mostTransferredPlayer: player ?? undefined,
      highestFeePlayer: mostExpensive
        ? {
            playerId: mostExpensive.player.id,
            playerName: `${mostExpensive.player.firstName} ${mostExpensive.player.lastName}`,
            feeAmount: Number(mostExpensive.feeAmount),
          }
        : undefined,
    };
  }

  async getPeriods(query: PeriodsQueryDto): Promise<TransferPeriodDto[]> {
    if (query.year !== undefined) {
      const now = new Date().getFullYear();
      if (query.year < 1900 || query.year > now + 1) {
        throw new BadRequestException('Geçersiz yıl');
      }
    }
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:periods', { year: query.year }),
      CacheTtl.List,
      async () => {
        const periods = await this.repo.getPeriods(query.year);
        return periods.map((p) => ({
          id: p.id,
          name: p.name,
          periodType: p.periodType ?? undefined,
          startDate: p.startDate,
          endDate: p.endDate,
        }));
      },
      [CacheTag.Transfers],
    );
  }

  async getPeriodSummary(
    query: PeriodSummaryQueryDto,
  ): Promise<TransferPeriodSummaryDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:periodSummary', { ...query }),
      CacheTtl.List,
      () => this.computePeriodSummary(query),
      [CacheTag.Transfers],
    );
  }

  private async computePeriodSummary(
    query: PeriodSummaryQueryDto,
  ): Promise<TransferPeriodSummaryDto> {
    const { range, periodName } = await this.resolveRange(
      query.year,
      query.transferPeriodId,
    );
    const transfers = await this.repo.listInRange({
      isRumour: false,
      transferDate: { gte: range.start, lte: range.end },
    });
    const { lines, total } = await this.convertLines(
      transfers,
      query.baseCurrency,
    );
    return {
      periodName,
      year: query.year,
      startDate: range.start,
      endDate: range.end,
      baseCurrency: query.baseCurrency,
      totalTransfers: transfers.length,
      totalSpent: total,
      topTransfers: lines.slice(0, 10),
    };
  }

  async getSeasonDashboard(
    query: SeasonDashboardQueryDto,
  ): Promise<TransferSeasonDashboardDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:seasonDashboard', { ...query }),
      CacheTtl.List,
      () => this.computeSeasonDashboard(query),
      [CacheTag.Transfers],
    );
  }

  private async computeSeasonDashboard(
    query: SeasonDashboardQueryDto,
  ): Promise<TransferSeasonDashboardDto> {
    const { range, periodName } = await this.resolveRange(
      query.year,
      query.transferPeriodId,
    );
    const transfers = await this.repo.listInRange({
      isRumour: false,
      transferDate: { gte: range.start, lte: range.end },
    });
    const map = await this.currency.rateMap(
      transfers.map((t) => t.feeCurrency),
      query.baseCurrency,
    );

    const spenders = new Map<string, { teamName: string; total: number }>();
    let total = 0;
    for (const t of transfers) {
      const value = this.currency.convertWith(
        Number(t.feeAmount),
        t.feeCurrency,
        map,
      );
      total += value;
      const cur = spenders.get(t.toTeamId) ?? {
        teamName: t.toTeam.name,
        total: 0,
      };
      cur.total += value;
      spenders.set(t.toTeamId, cur);
    }

    const lines = transfers
      .map((t) => ({
        line: toTeamTransferLine(t),
        value: this.currency.convertWith(
          Number(t.feeAmount),
          t.feeCurrency,
          map,
        ),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, query.topN)
      .map((x) => ({ ...x.line, feeAmount: x.value }));

    const topSpenders = [...spenders.entries()]
      .map(([teamId, v]) => ({ teamId, teamName: v.teamName, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, query.topN);

    return {
      baseCurrency: query.baseCurrency,
      year: query.year,
      periodName,
      totalTransfers: transfers.length,
      totalSpent: total,
      topN: query.topN,
      topTransfers: lines,
      topSpenders,
    };
  }

  private async convertLines(
    transfers: TransferWithRel[],
    base: string,
  ): Promise<{ lines: TeamTransferLineDto[]; total: number }> {
    const map = await this.currency.rateMap(
      transfers.map((t) => t.feeCurrency),
      base,
    );
    let total = 0;
    const lines = transfers
      .map((t) => {
        const value = this.currency.convertWith(
          Number(t.feeAmount),
          t.feeCurrency,
          map,
        );
        total += value;
        return { ...toTeamTransferLine(t), feeAmount: value };
      })
      .sort((a, b) => b.feeAmount - a.feeAmount);
    return { lines, total };
  }

  private async resolveRange(
    year?: number,
    transferPeriodId?: string,
  ): Promise<{ range: Range; periodName?: string }> {
    if (transferPeriodId) {
      const period = await this.repo.getPeriodById(transferPeriodId);
      if (!period) {
        throw new BadRequestException('Transfer dönemi bulunamadı');
      }
      return {
        range: { start: period.startDate, end: period.endDate },
        periodName: period.name,
      };
    }
    if (year !== undefined) {
      return {
        range: {
          start: new Date(Date.UTC(year, 0, 1)),
          end: new Date(Date.UTC(year + 1, 0, 1)),
        },
      };
    }
    throw new BadRequestException('year veya transferPeriodId zorunlu');
  }

  private async buildWhere(
    filter: StatsFilterDto,
  ): Promise<Prisma.TransferWhereInput> {
    const where: Prisma.TransferWhereInput = { isRumour: false };
    if (filter.playerId) {
      where.playerId = filter.playerId;
    }
    if (filter.teamId) {
      where.OR = [{ toTeamId: filter.teamId }, { fromTeamId: filter.teamId }];
    }
    if (filter.currency) {
      where.feeCurrency = filter.currency;
    }

    if (filter.transferPeriodId) {
      const period = await this.repo.getPeriodById(filter.transferPeriodId);
      if (period) {
        where.transferDate = { gte: period.startDate, lte: period.endDate };
      }
    } else if (filter.year !== undefined && filter.month !== undefined) {
      where.transferDate = {
        gte: new Date(Date.UTC(filter.year, filter.month - 1, 1)),
        lt: new Date(Date.UTC(filter.year, filter.month, 1)),
      };
    } else if (filter.year !== undefined) {
      where.transferDate = {
        gte: new Date(Date.UTC(filter.year, 0, 1)),
        lt: new Date(Date.UTC(filter.year + 1, 0, 1)),
      };
    } else if (filter.dateFrom || filter.dateTo) {
      where.transferDate = { gte: filter.dateFrom, lte: filter.dateTo };
    }
    return where;
  }
}
