import { Inject, Injectable } from '@nestjs/common';
import { Prisma, TransferPeriod } from '@prisma/client';
import {
  EXTENDED_PRISMA,
  ExtendedPrismaClient,
} from '../../common/prisma/extended-prisma';
import { TransferWithRel, transferInclude } from '../transfer.repository';
import {
  AggregateResult,
  IStatsRepository,
  PlayerCount,
  TeamCount,
} from './stats.repository';

@Injectable()
export class PrismaStatsRepository implements IStatsRepository {
  constructor(
    @Inject(EXTENDED_PRISMA) private readonly prisma: ExtendedPrismaClient,
  ) {}

  async aggregate(where: Prisma.TransferWhereInput): Promise<AggregateResult> {
    const r = await this.prisma.transfer.aggregate({
      where,
      _count: { _all: true },
      _sum: { feeAmount: true },
      _avg: { feeAmount: true },
      _max: { feeAmount: true },
      _min: { feeAmount: true },
    });
    return {
      totalTransfers: r._count._all,
      totalSpent: Number(r._sum.feeAmount ?? 0),
      averageFee: Number(r._avg.feeAmount ?? 0),
      maxFee: Number(r._max.feeAmount ?? 0),
      minFee: Number(r._min.feeAmount ?? 0),
    };
  }

  topByFee(where: Prisma.TransferWhereInput): Promise<TransferWithRel | null> {
    return this.prisma.transfer.findFirst({
      where,
      orderBy: { feeAmount: 'desc' },
      include: transferInclude,
    });
  }

  edge(
    where: Prisma.TransferWhereInput,
    order: 'asc' | 'desc',
  ): Promise<TransferWithRel | null> {
    return this.prisma.transfer.findFirst({
      where,
      orderBy: { createdAt: order },
      include: transferInclude,
    });
  }

  async mostActiveTeam(
    where: Prisma.TransferWhereInput,
    direction: 'buyer' | 'seller',
  ): Promise<TeamCount | null> {
    const field = direction === 'buyer' ? 'toTeamId' : 'fromTeamId';
    const grouped = await this.prisma.transfer.groupBy({
      by: [field],
      where,
      _count: { _all: true },
      orderBy: { _count: { [field]: 'desc' } },
      take: 1,
    });
    if (!grouped.length) {
      return null;
    }
    const teamId = grouped[0][field] as string;
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    return {
      teamId,
      teamName: team?.name ?? '',
      count: grouped[0]._count._all,
    };
  }

  async mostTransferredPlayer(
    where: Prisma.TransferWhereInput,
  ): Promise<PlayerCount | null> {
    const grouped = await this.prisma.transfer.groupBy({
      by: ['playerId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { playerId: 'desc' } },
      take: 1,
    });
    if (!grouped.length) {
      return null;
    }
    const playerId = grouped[0].playerId;
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { firstName: true, lastName: true },
    });
    return {
      playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : '',
      count: grouped[0]._count._all,
    };
  }

  listInRange(where: Prisma.TransferWhereInput): Promise<TransferWithRel[]> {
    return this.prisma.transfer.findMany({
      where,
      orderBy: { feeAmount: 'desc' },
      include: transferInclude,
    });
  }

  getPeriods(year?: number): Promise<TransferPeriod[]> {
    return this.prisma.transferPeriod.findMany({
      where: year
        ? {
            startDate: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }
        : undefined,
      orderBy: { startDate: 'asc' },
    });
  }

  getPeriodById(id: string): Promise<TransferPeriod | null> {
    return this.prisma.transferPeriod.findUnique({ where: { id } });
  }
}
