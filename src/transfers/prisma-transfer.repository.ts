import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EXTENDED_PRISMA,
  ExtendedPrismaClient,
} from '../common/prisma/extended-prisma';
import { toSkipTake } from '../common/pagination';
import {
  ITransferRepository,
  Paged,
  RumourUpdateInput,
  RumourWriteInput,
  TransferFilter,
  TransferPatchInput,
  TransferWithRel,
  TransferWriteInput,
  transferInclude,
} from './transfer.repository';

const SORT_FIELDS = new Set(['createdAt', 'transferDate', 'feeAmount']);

function isNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}

function mapWriteError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    throw new NotFoundException('Oyuncu veya takım bulunamadı');
  }
  throw e;
}

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
      select: { id: true, name: true, nameTr: true, leagueLogo: true },
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

  async existsDuplicate(
    playerId: string,
    fromTeamId: string,
    toTeamId: string,
    transferDate: Date,
  ): Promise<boolean> {
    const dup = await this.prisma.transfer.findFirst({
      where: { playerId, fromTeamId, toTeamId, transferDate },
      select: { id: true },
    });
    return dup !== null;
  }

  findOpenRumour(
    playerId: string,
    fromTeamId: string,
    toTeamId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.transfer.findFirst({
      where: {
        playerId,
        fromTeamId,
        toTeamId,
        isRumour: true,
        isDeleted: false,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTransfer(
    data: TransferWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    try {
      const t = tx
        ? await tx.transfer.create({ data })
        : await this.prisma.transfer.create({ data });
      return { id: t.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  async updateTransfer(id: string, data: TransferWriteInput): Promise<boolean> {
    try {
      await this.prisma.transfer.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      mapWriteError(e);
    }
  }

  async patchTransfer(id: string, data: TransferPatchInput): Promise<boolean> {
    try {
      await this.prisma.transfer.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async softDelete(id: string): Promise<boolean> {
    // EXTENDED_PRISMA delete → update isDeleted:true
    try {
      await this.prisma.transfer.delete({ where: { id } });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async createRumour(
    data: RumourWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    try {
      const createData = { ...data, isRumour: true, transferDate: new Date() };
      const t = tx
        ? await tx.transfer.create({ data: createData })
        : await this.prisma.transfer.create({ data: createData });
      return { id: t.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  getRumourMeta(
    id: string,
  ): Promise<{ createdByUserId: string | null; isRumour: boolean } | null> {
    return this.prisma.transfer.findFirst({
      where: { id, isRumour: true },
      select: { createdByUserId: true, isRumour: true },
    });
  }

  async updateRumour(id: string, data: RumourUpdateInput): Promise<boolean> {
    try {
      await this.prisma.transfer.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      mapWriteError(e);
    }
  }

  async confirmRumour(
    id: string,
    data: TransferPatchInput,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    try {
      await client.transfer.update({
        where: { id },
        data: {
          isRumour: false,
          feeAmount: data.feeAmount,
          feeCurrency: data.feeCurrency,
          transferDate: data.transferDate,
          updatedAt: new Date(),
        },
      });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  getByTeamIdRumour(teamId: string) {
    return this.list({
      isRumour: true,
      OR: [{ toTeamId: teamId }, { fromTeamId: teamId }],
    });
  }
}
