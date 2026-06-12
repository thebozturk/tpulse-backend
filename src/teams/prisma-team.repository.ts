import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  ITeamRepository,
  TeamDetailWithRel,
  TeamWithRel,
  TeamWriteInput,
} from './team.repository';

function mapWriteError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException('Takım adı zaten kullanımda');
    }
    if (e.code === 'P2003') {
      throw new NotFoundException('Lig bulunamadı');
    }
  }
  throw e;
}

function isNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}

const include = {
  league: { select: { name: true, nameTr: true } },
  _count: { select: { players: true } },
} satisfies object;

@Injectable()
export class PrismaTeamRepository implements ITeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<{ items: TeamWithRel[]; total: number }> {
    // Aksan-duyarsız (f_unaccent) isim araması — name + nameTr (token-AND).
    if (search?.trim()) {
      return this.searchAll(page, pageSize, search.trim());
    }
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
        include,
      }),
      this.prisma.team.count(),
    ]);
    return { items, total };
  }

  private async searchAll(
    page: number,
    pageSize: number,
    q: string,
  ): Promise<{ items: TeamWithRel[]; total: number }> {
    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
    // name VEYA nameTr içinde her token geçmeli (ikisi de aksan-duyarsız).
    const target = Prisma.sql`f_unaccent(lower(name || ' ' || coalesce("nameTr", '')))`;
    const tokenSql = Prisma.join(
      tokens.map(
        (t) => Prisma.sql`${target} LIKE '%' || f_unaccent(lower(${t})) || '%'`,
      ),
      ' AND ',
    );
    const { skip, take } = toSkipTake(page, pageSize);

    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "team" WHERE ${tokenSql}
        ORDER BY similarity(f_unaccent(lower(name)), f_unaccent(lower(${q}))) DESC, name ASC
        LIMIT ${take} OFFSET ${skip}`),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "team" WHERE ${tokenSql}`),
    ]);
    const ids = idRows.map((r) => r.id);
    const total = Number(countRows[0]?.count ?? 0);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const teams = await this.prisma.team.findMany({
      where: { id: { in: ids } },
      include,
    });
    const byId = new Map(teams.map((t) => [t.id, t]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((t): t is TeamWithRel => t !== undefined);
    return { items, total };
  }

  getById(id: string): Promise<TeamWithRel | null> {
    return this.prisma.team.findUnique({ where: { id }, include });
  }

  getByLeagueId(leagueId: string): Promise<TeamWithRel[]> {
    return this.prisma.team.findMany({
      where: { leagueId },
      orderBy: { name: 'asc' },
      include,
    });
  }

  getDetailById(id: string): Promise<TeamDetailWithRel | null> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        league: { select: { name: true, nameTr: true, leagueLogo: true } },
        players: {
          include: {
            position: { select: { nameEn: true } },
            // Kadro oyuncusunun tüm sezon stat satırları; mapper takımın ligine ait
            // olanı seçer (lig bağlamı için leagueId + season).
            statistics: {
              select: {
                leagueId: true,
                season: true,
                appearances: true,
                minutes: true,
                goalsTotal: true,
                goalsAssists: true,
                rating: true,
                cardsYellow: true,
                cardsRed: true,
              },
            },
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
        _count: { select: { players: true } },
      },
    });
  }

  async create(data: TeamWriteInput): Promise<{ id: string }> {
    try {
      const team = await this.prisma.team.create({ data });
      return { id: team.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  async update(id: string, data: TeamWriteInput): Promise<boolean> {
    try {
      await this.prisma.team.update({ where: { id }, data });
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
      await this.prisma.team.delete({ where: { id } });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async updateImage(
    id: string,
    url: string | null,
    locked: boolean,
  ): Promise<boolean> {
    try {
      await this.prisma.team.update({
        where: { id },
        data: { logo: url, logoLockedByAdmin: locked },
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
    return (await this.prisma.team.count({ where: { id } })) > 0;
  }
}
