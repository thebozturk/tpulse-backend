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

  async getAll(
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
    search?: string,
    sourceName?: string,
  ): Promise<{ items: NewsWithRel[]; total: number }> {
    if (search?.trim()) {
      return this.searchAll(
        search.trim(),
        sourceName,
        page,
        pageSize,
        sortBy,
        order,
      );
    }
    return this.paged({ sourceName }, page, pageSize, { [sortBy]: order });
  }

  /** Başlık araması (aksan-duyarsız, token-AND) + opsiyonel kaynak; id-çözümlü. */
  private async searchAll(
    q: string,
    sourceName: string | undefined,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }> {
    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
    const title = Prisma.sql`f_unaccent(lower(title))`;
    const conds: Prisma.Sql[] = [
      Prisma.join(
        tokens.map(
          (t) =>
            Prisma.sql`${title} LIKE '%' || f_unaccent(lower(${t})) || '%'`,
        ),
        ' AND ',
      ),
    ];
    if (sourceName) {
      conds.push(Prisma.sql`"sourceName" = ${sourceName}`);
    }
    const whereSql = Prisma.join(conds, ' AND ');
    const orderSql =
      sortBy === 'title'
        ? Prisma.sql`title ${order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}`
        : Prisma.sql`"publishDate" ${order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}`;
    const { skip, take } = toSkipTake(page, pageSize);

    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ news_id: string }[]>(Prisma.sql`
        SELECT news_id FROM "news" WHERE ${whereSql}
        ORDER BY ${orderSql} LIMIT ${take} OFFSET ${skip}`),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "news" WHERE ${whereSql}`),
    ]);
    const ids = idRows.map((r) => r.news_id);
    const total = Number(countRows[0]?.count ?? 0);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const rows = await this.prisma.news.findMany({
      where: { id: { in: ids } },
      include,
    });
    const byId = new Map(rows.map((n) => [n.id, n]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((n): n is NewsWithRel => n !== undefined);
    return { items, total };
  }

  async distinctSources(): Promise<string[]> {
    const rows = await this.prisma.news.findMany({
      where: { sourceName: { not: null } },
      distinct: ['sourceName'],
      select: { sourceName: true },
      orderBy: { sourceName: 'asc' },
    });
    return rows.map((r) => r.sourceName).filter((s): s is string => s !== null);
  }

  getById(id: string): Promise<NewsWithRel | null> {
    return this.prisma.news.findUnique({ where: { id }, include });
  }

  getByPlayerId(
    playerId: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ) {
    return this.paged({ playerId }, page, pageSize, { [sortBy]: order });
  }

  getByToTeamId(
    teamId: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ) {
    return this.paged({ toTeamId: teamId }, page, pageSize, {
      [sortBy]: order,
    });
  }

  getByFromTeamId(
    teamId: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ) {
    return this.paged({ fromTeamId: teamId }, page, pageSize, {
      [sortBy]: order,
    });
  }

  getBySourceName(
    sourceName: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ) {
    return this.paged({ sourceName }, page, pageSize, { [sortBy]: order });
  }

  getByDateRange(
    start: Date,
    end: Date,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ) {
    return this.paged(
      { publishDate: { gte: start, lte: end } },
      page,
      pageSize,
      {
        [sortBy]: order,
      },
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
