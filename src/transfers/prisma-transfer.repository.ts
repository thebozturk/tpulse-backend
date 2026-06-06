import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EXTENDED_PRISMA,
  ExtendedPrismaClient,
} from '../common/prisma/extended-prisma';
import { toSkipTake } from '../common/pagination';
import {
  ITransferRepository,
  Paged,
  TransferFilter,
  TransferWithRel,
  transferInclude,
} from './transfer.repository';

const SORT_FIELDS = new Set(['createdAt', 'transferDate', 'feeAmount']);

@Injectable()
export class PrismaTransferRepository implements ITransferRepository {
  constructor(
    @Inject(EXTENDED_PRISMA) private readonly prisma: ExtendedPrismaClient,
  ) {}

  private orderBy(sort?: string): Prisma.TransferOrderByWithRelationInput {
    if (!sort) {
      return { createdAt: 'desc' };
    }
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    if (!SORT_FIELDS.has(field)) {
      return { createdAt: 'desc' };
    }
    return { [field]: desc ? 'desc' : 'asc' };
  }

  private baseWhere(
    filter: TransferFilter,
    isRumour: boolean,
  ): Prisma.TransferWhereInput {
    return {
      isRumour,
      playerId: filter.playerId,
      fromTeamId: filter.fromTeamId,
      toTeamId: filter.toTeamId,
      createdByUserId: filter.ownerId,
      feeCurrency: filter.currency,
      ...(filter.dateFrom || filter.dateTo
        ? { transferDate: { gte: filter.dateFrom, lte: filter.dateTo } }
        : {}),
      ...(filter.feeMin !== undefined || filter.feeMax !== undefined
        ? { feeAmount: { gte: filter.feeMin, lte: filter.feeMax } }
        : {}),
    };
  }

  private async pagedBy(
    where: Prisma.TransferWhereInput,
    page: number,
    pageSize: number,
    sort?: string,
  ): Promise<Paged<TransferWithRel>> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        skip,
        take,
        orderBy: this.orderBy(sort),
        include: transferInclude,
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return { items, total };
  }

  private list(
    where: Prisma.TransferWhereInput,
    sort?: string,
    take?: number,
  ): Promise<TransferWithRel[]> {
    return this.prisma.transfer.findMany({
      where,
      orderBy: this.orderBy(sort),
      take,
      include: transferInclude,
    });
  }

  query(
    filter: TransferFilter,
    isRumour: boolean,
  ): Promise<Paged<TransferWithRel>> {
    return this.pagedBy(
      this.baseWhere(filter, isRumour),
      filter.page,
      filter.pageSize,
      filter.sort,
    );
  }

  getById(id: string, isRumour: boolean): Promise<TransferWithRel | null> {
    return this.prisma.transfer.findFirst({
      where: { id, isRumour },
      include: transferInclude,
    });
  }

  getLatest(page: number, pageSize: number, isRumour: boolean) {
    return this.pagedBy({ isRumour }, page, pageSize);
  }

  getTopExpensive(
    currency: string | undefined,
    page: number,
    pageSize: number,
  ) {
    return this.pagedBy(
      { isRumour: false, feeCurrency: currency },
      page,
      pageSize,
      '-feeAmount',
    );
  }

  getBetweenTeams(
    fromTeamId: string,
    toTeamId: string,
    includeReverse: boolean,
  ) {
    const where: Prisma.TransferWhereInput = includeReverse
      ? {
          isRumour: false,
          OR: [
            { fromTeamId, toTeamId },
            { fromTeamId: toTeamId, toTeamId: fromTeamId },
          ],
        }
      : { isRumour: false, fromTeamId, toTeamId };
    return this.list(where);
  }

  getByYear(year: number) {
    return this.list({
      isRumour: false,
      transferDate: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    });
  }

  getByMonth(year: number, month: number) {
    return this.list({
      isRumour: false,
      transferDate: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      },
    });
  }

  getByLeagueId(
    leagueId: string,
    year: number | undefined,
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.TransferWhereInput = {
      isRumour: false,
      OR: [{ toTeam: { leagueId } }, { fromTeam: { leagueId } }],
      ...(year
        ? {
            transferDate: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }
        : {}),
    };
    return this.pagedBy(where, page, pageSize);
  }

  getLatestByLeagueId(leagueId: string, take: number, year?: number) {
    return this.list(
      {
        isRumour: false,
        OR: [{ toTeam: { leagueId } }, { fromTeam: { leagueId } }],
        ...(year
          ? {
              transferDate: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              },
            }
          : {}),
      },
      undefined,
      take,
    );
  }

  getLeagueDirectional(
    leagueId: string,
    direction: 'incoming' | 'outgoing',
    filter: TransferFilter,
  ) {
    const teamRel = direction === 'incoming' ? 'toTeam' : 'fromTeam';
    const where: Prisma.TransferWhereInput = {
      isRumour: false,
      [teamRel]: { leagueId },
      playerId: filter.playerId,
      ...(filter.dateFrom || filter.dateTo
        ? { transferDate: { gte: filter.dateFrom, lte: filter.dateTo } }
        : {}),
    };
    return this.pagedBy(where, filter.page, filter.pageSize, filter.sort);
  }

  async getLatestByAllLeagues(take: number, year?: number) {
    const leagues = await this.prisma.league.findMany({
      select: { id: true, name: true, leagueLogo: true },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      leagues.map(async (league) => ({
        league,
        transfers: await this.getLatestByLeagueId(league.id, take, year),
      })),
    );
  }

  getByTeamDirectional(
    teamId: string,
    direction: 'incoming' | 'outgoing' | 'all',
  ) {
    const where: Prisma.TransferWhereInput =
      direction === 'incoming'
        ? { isRumour: false, toTeamId: teamId }
        : direction === 'outgoing'
          ? { isRumour: false, fromTeamId: teamId }
          : {
              isRumour: false,
              OR: [{ toTeamId: teamId }, { fromTeamId: teamId }],
            };
    return this.list(where);
  }

  getRecentByTeam(
    teamId: string,
    direction: 'incoming' | 'outgoing',
    take: number,
  ) {
    const where: Prisma.TransferWhereInput =
      direction === 'incoming'
        ? { isRumour: false, toTeamId: teamId }
        : { isRumour: false, fromTeamId: teamId };
    return this.list(where, undefined, take);
  }

  getByPlayerId(playerId: string) {
    return this.list({ isRumour: false, playerId });
  }

  async getLastByPlayerId(playerId: string) {
    const [latest] = await this.list(
      { isRumour: false, playerId },
      undefined,
      1,
    );
    return latest ?? null;
  }

  getByPlayerIdRumour(playerId: string) {
    return this.list({ isRumour: true, playerId });
  }

  getByTeamIdRumour(teamId: string) {
    return this.list({
      isRumour: true,
      OR: [{ toTeamId: teamId }, { fromTeamId: teamId }],
    });
  }
}
