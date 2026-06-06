import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, throwError, timeout, timer } from 'rxjs';
import {
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  ExternalTransfer,
  IFootballDataClient,
} from './football-data.client';

interface ApiEnvelope<T> {
  response: T[];
  paging?: { current: number; total: number };
}
interface RawLeague {
  league: { id: number; name: string; logo: string };
  country: { name: string; flag: string };
}
interface RawTeam {
  team: { id: number; name: string; logo?: string; founded?: number };
  venue: { name?: string; city?: string; capacity?: number };
}
interface RawPlayer {
  player: {
    id: number;
    firstname: string;
    lastname: string;
    nationality: string;
    birth: { date?: string };
    height?: string;
    weight?: string;
    photo?: string;
  };
  statistics: { games: { position?: string } }[];
}
interface RawTransferEntry {
  player: { id: number };
  transfers: {
    date: string;
    teams: { in: { id: number }; out: { id: number } };
  }[];
}

function parseNum(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

const TIMEOUT_MS = 30_000;

@Injectable()
export class AxiosFootballDataClient implements IFootballDataClient {
  private readonly logger = new Logger(AxiosFootballDataClient.name);
  private readonly baseUrl: string;
  private readonly key: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('apiFootball.baseUrl');
    this.key = this.config.get<string>('apiFootball.key') ?? '';
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<ApiEnvelope<T>> {
    const res = await firstValueFrom(
      this.http
        .get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, {
          headers: { 'x-apisports-key': this.key },
          params,
        })
        .pipe(
          timeout(TIMEOUT_MS),
          retry({
            count: 3,
            delay: (err: { response?: { status?: number } }, n) => {
              const status = err?.response?.status ?? 0;
              if (status === 429 || status >= 500) {
                return timer(n * 1000);
              }
              return throwError(() => err);
            },
          }),
        ),
    );
    return res.data;
  }

  async getLeague(
    externalId: number,
    season: number,
  ): Promise<ExternalLeague | null> {
    const data = await this.get<RawLeague>('/leagues', {
      id: externalId,
      season,
    });
    const r = data.response[0];
    if (!r) return null;
    return {
      externalId: r.league.id,
      name: r.league.name,
      country: r.country.name,
      countryLogo: r.country.flag,
      leagueLogo: r.league.logo,
    };
  }

  async getTeamsByLeague(
    leagueExternalId: number,
    season: number,
  ): Promise<ExternalTeam[]> {
    const data = await this.get<RawTeam>('/teams', {
      league: leagueExternalId,
      season,
    });
    return data.response.map((r) => ({
      externalId: r.team.id,
      name: r.team.name,
      logo: r.team.logo,
      founded: r.team.founded,
      venueName: r.venue?.name,
      venueCity: r.venue?.city,
      venueCapacity: r.venue?.capacity,
    }));
  }

  async getPlayersByTeam(
    teamExternalId: number,
    season: number,
    page: number,
  ): Promise<{ items: ExternalPlayer[]; totalPages: number }> {
    const data = await this.get<RawPlayer>('/players', {
      team: teamExternalId,
      season,
      page,
    });
    return {
      items: data.response.map((r) => ({
        externalId: r.player.id,
        firstName: r.player.firstname,
        lastName: r.player.lastname,
        nationality: r.player.nationality,
        birthDate: r.player.birth?.date,
        height: parseNum(r.player.height),
        weight: parseNum(r.player.weight),
        photo: r.player.photo,
        position: r.statistics?.[0]?.games?.position,
      })),
      totalPages: data.paging?.total ?? 1,
    };
  }

  async getTransfersByTeam(
    teamExternalId: number,
  ): Promise<ExternalTransfer[]> {
    const data = await this.get<RawTransferEntry>('/transfers', {
      team: teamExternalId,
    });
    const out: ExternalTransfer[] = [];
    for (const entry of data.response) {
      for (const t of entry.transfers ?? []) {
        out.push({
          playerExtId: entry.player.id,
          date: t.date,
          fromTeamExtId: t.teams.out.id,
          toTeamExtId: t.teams.in.id,
        });
      }
    }
    return out;
  }
}
