import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  IPlayerRepository,
  PlayerDetailWithRel,
  PlayerFilter,
  PlayerWithRel,
  PlayerWriteInput,
} from './player.repository';

function isNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}

function mapWriteError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    throw new NotFoundException('Takım veya pozisyon bulunamadı');
  }
  throw e;
}

const include = {
  team: { select: { name: true, nameTr: true, logo: true } },
  position: { select: { nameEn: true } },
} satisfies object;

// Tekil GET — temel ilişkiler + tüm istatistikler (lig/takım bağlamıyla, sezona göre).
const detailInclude = {
  team: { select: { name: true, nameTr: true, logo: true } },
  position: { select: { nameEn: true } },
  statistics: {
    include: {
      league: { select: { name: true, nameTr: true, leagueLogo: true } },
      team: { select: { name: true, nameTr: true, logo: true } },
    },
    orderBy: [{ season: 'desc' }, { leagueExternalId: 'asc' }],
  },
} satisfies Prisma.PlayerInclude;

@Injectable()
export class PrismaPlayerRepository implements IPlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(
    filter: PlayerFilter,
  ): Promise<{ items: PlayerWithRel[]; total: number }> {
    // Metinsel arama: aksan-duyarsız (f_unaccent) + tam isim (token-AND).
    // "victor osimhen" → her token tam ad içinde geçer; "kilicsoy" → "Kılıçsoy".
    if (filter.search?.trim()) {
      return this.searchAll(filter);
    }
    const where: Prisma.PlayerWhereInput = {
      teamId: filter.teamId,
      nationality: filter.nationality,
      positionId: filter.positionId,
      isFree: filter.isFree,
      // Lig filtresi takım ilişkisi üzerinden (player'da doğrudan leagueId yok).
      ...(filter.leagueId ? { team: { leagueId: filter.leagueId } } : {}),
    };
    const { skip, take } = toSkipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include,
      }),
      this.prisma.player.count({ where }),
    ]);
    return { items, total };
  }

  /** f_unaccent token-AND arama + diğer filtreler; benzerliğe göre sıralı, paged. */
  private async searchAll(
    filter: PlayerFilter,
  ): Promise<{ items: PlayerWithRel[]; total: number }> {
    const q = filter.search!.trim();
    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
    const fullName = Prisma.sql`f_unaccent(lower("firstName" || ' ' || "lastName"))`;
    const conds: Prisma.Sql[] = [
      Prisma.join(
        tokens.map(
          (t) =>
            Prisma.sql`${fullName} LIKE '%' || f_unaccent(lower(${t})) || '%'`,
        ),
        ' AND ',
      ),
    ];
    if (filter.leagueId) {
      // player'da leagueId yok → takım üzerinden subquery.
      conds.push(
        Prisma.sql`"teamId" IN (SELECT id FROM "team" WHERE "leagueId" = ${filter.leagueId}::uuid)`,
      );
    }
    if (filter.teamId) {
      conds.push(Prisma.sql`"teamId" = ${filter.teamId}::uuid`);
    }
    if (filter.nationality) {
      conds.push(Prisma.sql`nationality = ${filter.nationality}`);
    }
    if (filter.positionId) {
      conds.push(Prisma.sql`"positionId" = ${filter.positionId}::uuid`);
    }
    if (filter.isFree !== undefined) {
      conds.push(Prisma.sql`"isFree" = ${filter.isFree}`);
    }
    const whereSql = Prisma.join(conds, ' AND ');
    const { skip, take } = toSkipTake(filter.page, filter.pageSize);

    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "player" WHERE ${whereSql}
        ORDER BY similarity(${fullName}, f_unaccent(lower(${q}))) DESC, "lastName" ASC
        LIMIT ${take} OFFSET ${skip}`),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "player" WHERE ${whereSql}`),
    ]);
    const ids = idRows.map((r) => r.id);
    const total = Number(countRows[0]?.count ?? 0);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const players = await this.prisma.player.findMany({
      where: { id: { in: ids } },
      include,
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((p): p is PlayerWithRel => p !== undefined);
    return { items, total };
  }

  getById(id: string): Promise<PlayerDetailWithRel | null> {
    return this.prisma.player.findUnique({
      where: { id },
      include: detailInclude,
    });
  }

  getByTeamId(teamId: string): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { teamId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }

  getByNationality(nationality: string): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { nationality },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }

  getFreeAgents(): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { isFree: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }

  async create(data: PlayerWriteInput): Promise<{ id: string }> {
    try {
      const player = await this.prisma.player.create({ data });
      return { id: player.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  async update(id: string, data: PlayerWriteInput): Promise<boolean> {
    try {
      await this.prisma.player.update({ where: { id }, data });
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
      await this.prisma.player.delete({ where: { id } });
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
      await this.prisma.player.update({
        where: { id },
        data: { photo: url, photoLockedByAdmin: locked },
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
    return (await this.prisma.player.count({ where: { id } })) > 0;
  }
}
