import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  INewsRepository,
  NewsSort,
  NewsWithRel,
  SortOrder,
} from './news.repository';

const include = {
  player: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationality: true,
      photo: true,
    },
  },
  fromTeam: { select: { id: true, name: true, logo: true } },
  toTeam: { select: { id: true, name: true, logo: true } },
} satisfies object;

@Injectable()
export class PrismaNewsRepository implements INewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async paged(
    where: Prisma.NewsWhereInput,
    page: number,
    pageSize: number,
    orderBy: Prisma.NewsOrderByWithRelationInput = { publishDate: 'desc' },
  ): Promise<{ items: NewsWithRel[]; total: number }> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.news.findMany({ where, skip, take, orderBy, include }),
      this.prisma.news.count({ where }),
    ]);
    return { items, total };
  }

  getAll(
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }> {
    return this.paged({}, page, pageSize, { [sortBy]: order });
  }

  getById(id: string): Promise<NewsWithRel | null> {
    return this.prisma.news.findUnique({ where: { id }, include });
  }

  getByPlayerId(playerId: string, page: number, pageSize: number) {
    return this.paged({ playerId }, page, pageSize);
  }

  getByToTeamId(teamId: string, page: number, pageSize: number) {
    return this.paged({ toTeamId: teamId }, page, pageSize);
  }

  getByFromTeamId(teamId: string, page: number, pageSize: number) {
    return this.paged({ fromTeamId: teamId }, page, pageSize);
  }

  getBySourceName(sourceName: string, page: number, pageSize: number) {
    return this.paged({ sourceName }, page, pageSize);
  }

  getByDateRange(start: Date, end: Date, page: number, pageSize: number) {
    return this.paged(
      { publishDate: { gte: start, lte: end } },
      page,
      pageSize,
    );
  }
}
