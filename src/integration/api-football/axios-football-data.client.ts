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
    name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    nationality?: string | null;
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
    type?: string | null;
    teams: {
      in: { id?: number | null };
      out: { id?: number | null };
    };
  }[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

/**
 * API-Football `type` alanı bedeli serbest metin verir:
 *   "€ 2.5M" → 2_500_000 EUR | "€ 550K" → 550_000 | "Free"/"Loan"/"N/A" → 0.
 * Sayısal bedel yoksa 0/EUR döner (Free/Loan/N-A meşru olarak bedelsiz).
 */
function parseFee(type?: string | null): {
  feeAmount: number;
  feeCurrency: string;
} {
  const raw = (type ?? '').trim();
  const m = raw.match(/([€$£])\s*([\d.,]+)\s*([MmKk])?/);
  if (!m) {
    return { feeAmount: 0, feeCurrency: 'EUR' };
  }
  const feeCurrency = CURRENCY_SYMBOLS[m[1]] ?? 'EUR';
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (Number.isNaN(num)) {
    return { feeAmount: 0, feeCurrency };
  }
  const unit = (m[3] ?? '').toUpperCase();
  const factor = unit === 'M' ? 1_000_000 : unit === 'K' ? 1_000 : 1;
  return { feeAmount: Math.round(num * factor), feeCurrency };
}

function parseNum(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Şema VarChar(32) sınırı + zorunlu alan fallback (canlı uçta null gelebilir). */
function trunc(
  v: string | null | undefined,
  max: number,
  fallback: string,
): string {
  const s = (v ?? '').trim();
  return (s.length ? s : fallback).slice(0, max);
}

/**
 * Uyruk kanonikleştirme — API-Football aynı ülke için tutarsız değer verebiliyor
 * ("Turkey" / "Türkiye"). Mobil "Türkiye" değerine bakıyor → tek forma sabitle.
 */
function canonicalNationality(n: string): string {
  return n === 'Turkey' ? 'Türkiye' : n;
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
      name: trunc(r.league.name, 30, 'N/A'),
      country: trunc(r.country.name, 30, 'Unknown'),
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
      name: trunc(r.team.name, 50, 'N/A'),
      logo: r.team.logo,
      founded: r.team.founded,
      venueName: r.venue?.name?.slice(0, 100),
      venueCity: r.venue?.city?.slice(0, 100),
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
        firstName: trunc(
          r.player.firstname ?? r.player.name,
          32,
          r.player.name?.slice(0, 32) ?? 'N/A',
        ),
        lastName: trunc(
          r.player.lastname ?? r.player.name,
          32,
          r.player.name?.slice(0, 32) ?? 'N/A',
        ),
        nationality: canonicalNationality(
          trunc(r.player.nationality, 32, 'Unknown'),
        ),
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
        const fromId = t.teams?.out?.id;
        const toId = t.teams?.in?.id;
        // Eksik kulüp (serbest/bilinmeyen) veya tarih → atla; findUnique null'a düşmesin.
        if (!entry.player?.id || !fromId || !toId || !t.date) {
          continue;
        }
        const { feeAmount, feeCurrency } = parseFee(t.type);
        out.push({
          playerExtId: entry.player.id,
          date: t.date,
          fromTeamExtId: fromId,
          toTeamExtId: toId,
          feeAmount,
          feeCurrency,
        });
      }
    }
    return out;
  }
}
