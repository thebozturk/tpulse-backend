import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SeedResultDto } from './dto/seed-result.dto';
import { POSITIONS, positionCode } from './positions';

interface SeedPlayer {
  externalId: number;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate?: string;
  height?: number;
  weight?: number;
  photo?: string;
  position?: string;
}
interface SeedTeam {
  externalId: number;
  name: string;
  logo?: string;
  founded?: number;
  venueName?: string;
  venueCity?: string;
  venueCapacity?: number;
  players?: SeedPlayer[];
}
interface SeedLeague {
  externalId: number;
  name: string;
  country: string;
  countryLogo: string;
  leagueLogo: string;
  leagueCode?: string;
  teams?: SeedTeam[];
}
interface SeedJson {
  leagues: SeedLeague[];
}

@Injectable()
export class FootballDataSeeder {
  constructor(private readonly prisma: PrismaService) {}

  async seed(buffer: Buffer): Promise<SeedResultDto> {
    const json = this.parse(buffer);
    const r: SeedResultDto = {
      leaguesInserted: 0,
      leaguesUpdated: 0,
      teamsInserted: 0,
      teamsUpdated: 0,
      playersInserted: 0,
      playersUpdated: 0,
      positionsCreated: 0,
    };
    const positions = await this.ensurePositions(r);

    for (const lg of json.leagues) {
      const leagueId = await this.upsertLeague(lg, r);
      for (const t of lg.teams ?? []) {
        const teamId = await this.upsertTeam(t, leagueId, r);
        for (const p of t.players ?? []) {
          await this.upsertPlayer(p, teamId, positions, r);
        }
      }
    }
    return r;
  }

  private parse(buffer: Buffer): SeedJson {
    let json: SeedJson;
    try {
      json = JSON.parse(buffer.toString('utf-8')) as SeedJson;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }
    if (!Array.isArray(json?.leagues)) {
      throw new BadRequestException('leagues[] bekleniyor');
    }
    return json;
  }

  private async ensurePositions(
    r: SeedResultDto,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const pos of POSITIONS) {
      const existing = await this.prisma.position.findFirst({
        where: { codeEn: pos.codeEn },
        select: { id: true },
      });
      if (existing) {
        map.set(pos.codeEn, existing.id);
      } else {
        const created = await this.prisma.position.create({ data: pos });
        r.positionsCreated++;
        map.set(pos.codeEn, created.id);
      }
    }
    return map;
  }

  private async upsertLeague(
    lg: SeedLeague,
    r: SeedResultDto,
  ): Promise<string> {
    const data = {
      name: lg.name,
      country: lg.country,
      countryLogo: lg.countryLogo,
      leagueLogo: lg.leagueLogo,
      leagueCode: lg.leagueCode,
    };
    const existing = await this.prisma.league.findUnique({
      where: { externalId: lg.externalId },
    });
    if (existing) {
      r.leaguesUpdated++;
      await this.prisma.league.update({ where: { id: existing.id }, data });
      return existing.id;
    }
    r.leaguesInserted++;
    const created = await this.prisma.league.create({
      data: { externalId: lg.externalId, ...data },
    });
    return created.id;
  }

  private async upsertTeam(
    t: SeedTeam,
    leagueId: string,
    r: SeedResultDto,
  ): Promise<string> {
    const data = {
      name: t.name,
      logo: t.logo,
      founded: t.founded,
      venueName: t.venueName,
      venueCity: t.venueCity,
      venueCapacity: t.venueCapacity,
      leagueId,
    };
    const existing = await this.prisma.team.findUnique({
      where: { externalId: t.externalId },
    });
    if (existing) {
      r.teamsUpdated++;
      await this.prisma.team.update({ where: { id: existing.id }, data });
      return existing.id;
    }
    r.teamsInserted++;
    const created = await this.prisma.team.create({
      data: { externalId: t.externalId, ...data },
    });
    return created.id;
  }

  private async upsertPlayer(
    p: SeedPlayer,
    teamId: string,
    positions: Map<string, string>,
    r: SeedResultDto,
  ): Promise<void> {
    const code = positionCode(p.position);
    const data = {
      firstName: p.firstName,
      lastName: p.lastName,
      nationality: p.nationality,
      birthDate: p.birthDate ? new Date(p.birthDate) : undefined,
      height: p.height,
      weight: p.weight,
      photo: p.photo,
      teamId,
      positionId: code ? positions.get(code) : undefined,
    };
    const existing = await this.prisma.player.findUnique({
      where: { externalId: p.externalId },
      select: { id: true },
    });
    if (existing) {
      r.playersUpdated++;
      await this.prisma.player.update({ where: { id: existing.id }, data });
      return;
    }
    r.playersInserted++;
    await this.prisma.player.create({
      data: { externalId: p.externalId, ...data },
    });
  }
}
