import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlayerWithRel } from '../players/player.repository';
import {
  ISearchRepository,
  LeagueHit,
  PlayerHit,
  TeamHit,
} from './search.repository';

const playerInclude = {
  team: { select: { name: true, nameTr: true, logo: true } },
  position: { select: { nameEn: true } },
} satisfies object;

/**
 * Fuzzy search — parameterized $queryRaw (injection yok). Tüm karşılaştırmalar
 * f_unaccent(lower(...)) üzerinden: aksan/Türkçe karakter ve büyük-küçük harf
 * duyarsız (Özil↔Ozil, Şahin↔Sahin, İ/I/ı/i tek forma iner).
 *
 * Eşleşme: token-AND substring — sorgu boşluklara bölünür, HER token hedef metnin
 * içinde geçmeli. Böylece "victor osimhen" tam adı bulur ve "icardi"→"Mascardi"
 * gibi trigram gürültüsü elenir (panel liste aramasıyla aynı davranış).
 * Sıralama trigram similarity DESC; trgm GIN index'leri LIKE '%...%' için kullanılır.
 */
@Injectable()
export class PrismaSearchRepository implements ISearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Sorgunun her token'ı `target` ifadesinin içinde (aksan-duyarsız) geçmeli. */
  private tokenAnd(target: Prisma.Sql, q: string): Prisma.Sql {
    const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (tokens.length === 0) {
      return Prisma.sql`FALSE`;
    }
    return Prisma.join(
      tokens.map(
        (t) => Prisma.sql`${target} LIKE '%' || f_unaccent(lower(${t})) || '%'`,
      ),
      ' AND ',
    );
  }

  searchPlayers(q: string, limit: number): Promise<PlayerHit[]> {
    const full = Prisma.sql`f_unaccent(lower("firstName" || ' ' || "lastName"))`;
    return this.prisma.$queryRaw<PlayerHit[]>(Prisma.sql`
      SELECT id, "firstName", "lastName", "firstNameTr", "lastNameTr", photo, nationality
      FROM "player"
      WHERE ${this.tokenAnd(full, q)}
      ORDER BY similarity(${full}, f_unaccent(lower(${q}))) DESC, "lastName" ASC
      LIMIT ${limit}
    `);
  }

  searchTeams(q: string, limit: number): Promise<TeamHit[]> {
    const target = Prisma.sql`f_unaccent(lower(name || ' ' || coalesce("nameTr", '')))`;
    return this.prisma.$queryRaw<TeamHit[]>(Prisma.sql`
      SELECT id, name, "nameTr", logo
      FROM "team"
      WHERE ${this.tokenAnd(target, q)}
      ORDER BY similarity(f_unaccent(lower(name)), f_unaccent(lower(${q}))) DESC, name ASC
      LIMIT ${limit}
    `);
  }

  searchLeagues(q: string, limit: number): Promise<LeagueHit[]> {
    const target = Prisma.sql`f_unaccent(lower(name || ' ' || coalesce("nameTr", '')))`;
    return this.prisma.$queryRaw<LeagueHit[]>(Prisma.sql`
      SELECT id, name, "nameTr", "leagueLogo", country
      FROM "league"
      WHERE ${this.tokenAnd(target, q)}
      ORDER BY similarity(f_unaccent(lower(name)), f_unaccent(lower(${q}))) DESC, name ASC
      LIMIT ${limit}
    `);
  }

  async searchPlayersPaged(
    q: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PlayerWithRel[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const full = Prisma.sql`f_unaccent(lower("firstName" || ' ' || "lastName"))`;
    const where = this.tokenAnd(full, q);
    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "player" WHERE ${where}
        ORDER BY similarity(${full}, f_unaccent(lower(${q}))) DESC, "lastName" ASC
        LIMIT ${pageSize} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "player" WHERE ${where}
      `),
    ]);

    const ids = idRows.map((r) => r.id);
    const total = Number(countRows[0]?.count ?? 0);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const players = await this.prisma.player.findMany({
      where: { id: { in: ids } },
      include: playerInclude,
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is PlayerWithRel => p !== undefined);
    return { items: ordered, total };
  }
}
