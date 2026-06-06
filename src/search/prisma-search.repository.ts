import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlayerWithRel } from '../players/player.repository';
import {
  ISearchRepository,
  LeagueHit,
  PlayerHit,
  TeamHit,
} from './search.repository';

const playerInclude = {
  team: { select: { name: true, logo: true } },
  position: { select: { nameEn: true } },
} satisfies object;

/**
 * pg_trgm fuzzy search. Parameterized $queryRaw (injection yok — $queryRawUnsafe DEĞİL).
 * Eşleşme: substring (ILIKE) VEYA trigram (%), similarity DESC sıralama.
 */
@Injectable()
export class PrismaSearchRepository implements ISearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  searchPlayers(q: string, limit: number): Promise<PlayerHit[]> {
    return this.prisma.$queryRaw<PlayerHit[]>`
      SELECT id, "firstName", "lastName", photo, nationality
      FROM "player"
      WHERE ("firstName" || ' ' || "lastName") ILIKE '%' || ${q} || '%'
         OR "firstName" % ${q}
         OR "lastName" % ${q}
      ORDER BY GREATEST(
        similarity("firstName" || ' ' || "lastName", ${q}),
        similarity("firstName", ${q}),
        similarity("lastName", ${q})
      ) DESC, "lastName" ASC
      LIMIT ${limit}
    `;
  }

  searchTeams(q: string, limit: number): Promise<TeamHit[]> {
    return this.prisma.$queryRaw<TeamHit[]>`
      SELECT id, name, logo
      FROM "team"
      WHERE name ILIKE '%' || ${q} || '%' OR name % ${q}
      ORDER BY similarity(name, ${q}) DESC, name ASC
      LIMIT ${limit}
    `;
  }

  searchLeagues(q: string, limit: number): Promise<LeagueHit[]> {
    return this.prisma.$queryRaw<LeagueHit[]>`
      SELECT id, name, "leagueLogo", country
      FROM "league"
      WHERE name ILIKE '%' || ${q} || '%' OR name % ${q}
      ORDER BY similarity(name, ${q}) DESC, name ASC
      LIMIT ${limit}
    `;
  }

  async searchPlayersPaged(
    q: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PlayerWithRel[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "player"
      WHERE ("firstName" || ' ' || "lastName") ILIKE '%' || ${q} || '%'
         OR "firstName" % ${q}
         OR "lastName" % ${q}
      ORDER BY GREATEST(
        similarity("firstName" || ' ' || "lastName", ${q}),
        similarity("firstName", ${q}),
        similarity("lastName", ${q})
      ) DESC, "lastName" ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `;
    const countRows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM "player"
      WHERE ("firstName" || ' ' || "lastName") ILIKE '%' || ${q} || '%'
         OR "firstName" % ${q}
         OR "lastName" % ${q}
    `;

    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return { items: [], total: Number(countRows[0]?.count ?? 0) };
    }
    const players = await this.prisma.player.findMany({
      where: { id: { in: ids } },
      include: playerInclude,
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is PlayerWithRel => p !== undefined);
    return { items: ordered, total: Number(countRows[0]?.count ?? 0) };
  }
}
