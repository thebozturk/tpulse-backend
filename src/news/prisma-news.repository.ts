import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  INewsRepository,
  NewsSort,
  NewsWithRel,
  NewsWriteInput,
  SortOrder,
} from './news.repository';

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

const include = {
  player: {
    select: {
      id: true,
      firstName: true,
      firstNameTr: true,
      lastName: true,
      lastNameTr: true,
      nationality: true,
      photo: true,
    },
  },
  fromTeam: { select: { id: true, name: true, nameTr: true, logo: true } },
  toTeam: { select: { id: true, name: true, nameTr: true, logo: true } },
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

  async create(
    data: NewsWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const client = tx ?? this.prisma;
    try {
      const news = await client.news.create({ data });
      return { id: news.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  async update(id: string, data: NewsWriteInput): Promise<boolean> {
    try {
      await this.prisma.news.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      mapWriteError(e);
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.news.delete({ where: { id } });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async removeBulk(ids: string[]): Promise<number> {
    const { count } = await this.prisma.news.deleteMany({
      where: { id: { in: ids } },
    });
    return count;
  }

  async updateImage(id: string, url: string | null): Promise<boolean> {
    try {
      await this.prisma.news.update({
        where: { id },
        data: { imageUrl: url },
      });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.news.count({ where: { id } })) > 0;
  }
}
