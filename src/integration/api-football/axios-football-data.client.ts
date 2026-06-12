import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, throwError, timeout, timer } from 'rxjs';
import {
  ExternalLeagueMeta,
  ExternalPlayer,
  ExternalPlayerStat,
  ExternalSquadPlayer,
  ExternalTeam,
  ExternalTransfer,
  IFootballDataClient,
  QuotaExhaustedError,
} from './football-data.client';

interface ApiEnvelope<T> {
  response: T[];
  paging?: { current: number; total: number };
}
interface RawLeague {
  league: { id: number; name: string; logo: string; type: string };
  country: { name: string; flag: string | null };
  seasons?: { year: number; current?: boolean }[];
}
interface RawTeam {
  team: { id: number; name: string; logo?: string; founded?: number };
  venue: { name?: string; city?: string; capacity?: number };
}
interface RawStat {
  team?: { id?: number | null };
  league?: { id?: number | null; season?: number | null };
  games?: {
    appearences?: number | null;
    lineups?: number | null;
    minutes?: number | null;
    position?: string | null;
    rating?: string | null;
    captain?: boolean | null;
  };
  shots?: { total?: number | null; on?: number | null };
  goals?: {
    total?: number | null;
    conceded?: number | null;
    assists?: number | null;
    saves?: number | null;
  };
  passes?: {
    total?: number | null;
    key?: number | null;
    accuracy?: number | null;
  };
  tackles?: {
    total?: number | null;
    blocks?: number | null;
    interceptions?: number | null;
  };
  duels?: { total?: number | null; won?: number | null };
  dribbles?: { attempts?: number | null; success?: number | null };
  fouls?: { drawn?: number | null; committed?: number | null };
  cards?: {
    yellow?: number | null;
    yellowred?: number | null;
    red?: number | null;
  };
  penalty?: {
    won?: number | null;
    commited?: number | null; // API yazım hatası: tek 'm'
    scored?: number | null;
    missed?: number | null;
    saved?: number | null;
  };
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
  statistics: RawStat[];
}
interface RawSquad {
  team: { id: number };
  players: {
    id: number;
    name?: string | null;
    position?: string | null;
    photo?: string | null;
    number?: number | null;
  }[];
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

/** null/undefined → undefined; sayıyı round'lar (SmallInt'e oturur). */
function intOrUndef(v?: number | null): number | undefined {
  if (v === null || v === undefined) return undefined;
  return Math.round(v);
}

/** "7.142857" → 7.14 (Decimal(4,2)); null → undefined. */
function ratingOrUndef(v?: string | null): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : Math.round(n * 100) / 100;
}

/** Şema VarChar sınırı + zorunlu alan fallback (canlı uçta null gelebilir). */
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const TIMEOUT_MS = 30_000;

@Injectable()
export class AxiosFootballDataClient implements IFootballDataClient {
  private readonly logger = new Logger(AxiosFootballDataClient.name);
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly minIntervalMs: number;
  private readonly dailyReserve: number;

  // Throttle: get() çağrılarını seri zincire dizip minIntervalMs aralıkla yayar.
  private rateChain: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  // Kota: response header'ından okunan günlük kalan istek hakkı.
  private dailyRemaining = Number.POSITIVE_INFINITY;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('apiFootball.baseUrl');
    this.key = this.config.get<string>('apiFootball.key') ?? '';
    const maxRpm = this.config.get<number>('apiFootball.maxRpm') ?? 250;
    this.minIntervalMs = Math.ceil(60_000 / Math.max(1, maxRpm));
    this.dailyReserve =
      this.config.get<number>('apiFootball.dailyReserve') ?? 50;
  }

  /** Limit altı kalmak için ardışık istekleri minIntervalMs aralıkla seri yayar. */
  private async throttle(): Promise<void> {
    const prev = this.rateChain;
    let release!: () => void;
    this.rateChain = new Promise<void>((r) => (release = r));
    await prev;
    const wait = this.minIntervalMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) {
      await sleep(wait);
    }
    this.lastRequestAt = Date.now();
    release();
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<ApiEnvelope<T>> {
    if (this.dailyRemaining <= this.dailyReserve) {
      throw new QuotaExhaustedError(this.dailyRemaining);
    }
    await this.throttle();
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
    const rem = Number(
      (res.headers as Record<string, string>)?.[
        'x-ratelimit-requests-remaining'
      ],
    );
    if (!Number.isNaN(rem)) {
      this.dailyRemaining = rem;
    }
    return res.data;
  }

  private mapLeagueMeta(r: RawLeague): ExternalLeagueMeta {
    const seasons = r.seasons ?? [];
    const current = seasons.filter((s) => s.current).map((s) => s.year);
    const currentSeason = current.length
      ? Math.max(...current)
      : seasons.length
        ? Math.max(...seasons.map((s) => s.year))
        : null;
    return {
      externalId: r.league.id,
      name: trunc(r.league.name, 30, 'N/A'),
      country: trunc(r.country.name, 30, 'Unknown'),
      countryLogo: r.country.flag,
      leagueLogo: r.league.logo,
      currentSeason,
      type: r.league.type === 'Cup' ? 'Cup' : 'League',
    };
  }

  async getLeaguesIndex(): Promise<ExternalLeagueMeta[]> {
    const data = await this.get<RawLeague>('/leagues', {});
    return data.response.map((r) => this.mapLeagueMeta(r));
  }

  async getLeague(externalId: number): Promise<ExternalLeagueMeta | null> {
    const data = await this.get<RawLeague>('/leagues', { id: externalId });
    const r = data.response[0];
    return r ? this.mapLeagueMeta(r) : null;
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

  private mapStat(s: RawStat): ExternalPlayerStat | null {
    const leagueId = s.league?.id;
    const season = s.league?.season;
    if (!leagueId || !season) {
      return null; // lig/sezon olmadan unique key kurulamaz → atla
    }
    return {
      leagueExternalId: leagueId,
      season,
      teamExternalId: s.team?.id ?? undefined,
      appearances: intOrUndef(s.games?.appearences),
      lineups: intOrUndef(s.games?.lineups),
      minutes: intOrUndef(s.games?.minutes),
      rating: ratingOrUndef(s.games?.rating),
      captain: s.games?.captain === true,
      goalsTotal: intOrUndef(s.goals?.total),
      goalsConceded: intOrUndef(s.goals?.conceded),
      goalsAssists: intOrUndef(s.goals?.assists),
      goalsSaves: intOrUndef(s.goals?.saves),
      shotsTotal: intOrUndef(s.shots?.total),
      shotsOn: intOrUndef(s.shots?.on),
      passesTotal: intOrUndef(s.passes?.total),
      passesKey: intOrUndef(s.passes?.key),
      passesAccuracy: intOrUndef(s.passes?.accuracy),
      tacklesTotal: intOrUndef(s.tackles?.total),
      tacklesBlocks: intOrUndef(s.tackles?.blocks),
      tacklesInterceptions: intOrUndef(s.tackles?.interceptions),
      duelsTotal: intOrUndef(s.duels?.total),
      duelsWon: intOrUndef(s.duels?.won),
      dribblesAttempts: intOrUndef(s.dribbles?.attempts),
      dribblesSuccess: intOrUndef(s.dribbles?.success),
      foulsDrawn: intOrUndef(s.fouls?.drawn),
      foulsCommitted: intOrUndef(s.fouls?.committed),
      cardsYellow: intOrUndef(s.cards?.yellow),
      cardsYellowRed: intOrUndef(s.cards?.yellowred),
      cardsRed: intOrUndef(s.cards?.red),
      penaltyWon: intOrUndef(s.penalty?.won),
      penaltyCommitted: intOrUndef(s.penalty?.commited),
      penaltyScored: intOrUndef(s.penalty?.scored),
      penaltyMissed: intOrUndef(s.penalty?.missed),
      penaltySaved: intOrUndef(s.penalty?.saved),
    };
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
        position: r.statistics?.[0]?.games?.position ?? undefined,
        statistics: (r.statistics ?? [])
          .map((s) => this.mapStat(s))
          .filter((s): s is ExternalPlayerStat => s !== null),
      })),
      totalPages: data.paging?.total ?? 1,
    };
  }

  async getSquad(teamExternalId: number): Promise<ExternalSquadPlayer[]> {
    const data = await this.get<RawSquad>('/players/squads', {
      team: teamExternalId,
    });
    const entry = data.response[0];
    if (!entry?.players) {
      return [];
    }
    return entry.players.map((p) => ({
      externalId: p.id,
      name: trunc(p.name, 64, 'N/A'),
      position: p.position ?? undefined,
      photo: p.photo ?? undefined,
      number: p.number ?? undefined,
    }));
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
