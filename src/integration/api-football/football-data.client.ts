export const FOOTBALL_DATA_CLIENT = Symbol('FOOTBALL_DATA_CLIENT');

/**
 * Günlük API kotası tükendiğinde fırlatılır (response header
 * `x-ratelimit-requests-remaining` <= rezerv). Sync bunu yakalayıp kalan
 * ligleri ertesi güne erteler — banlanmak yerine kaldığı yerden devam.
 */
export class QuotaExhaustedError extends Error {
  constructor(public readonly remaining: number) {
    super(`API-Football günlük kota tükendi (kalan=${remaining})`);
    this.name = 'QuotaExhaustedError';
  }
}

export interface ExternalLeague {
  externalId: number;
  name: string;
  country: string;
  countryLogo: string | null; // Uluslararası kupalarda (World) flag null gelir
  leagueLogo: string;
}

/** /leagues cevabından türetilen meta + o ligin "current" sezonu. */
export interface ExternalLeagueMeta extends ExternalLeague {
  /** seasons[].current === true olan yıl; yoksa en güncel yıl. null = kapsam yok. */
  currentSeason: number | null;
  type: 'League' | 'Cup';
}

export interface ExternalTeam {
  externalId: number;
  name: string;
  logo?: string;
  founded?: number;
  venueName?: string;
  venueCity?: string;
  venueCapacity?: number;
}

/** Oyuncunun tek bir lig/sezon istatistik girdisi (/players statistics[]). */
export interface ExternalPlayerStat {
  leagueExternalId: number;
  season: number;
  teamExternalId?: number;
  appearances?: number;
  lineups?: number;
  minutes?: number;
  rating?: number;
  captain: boolean;
  goalsTotal?: number;
  goalsConceded?: number;
  goalsAssists?: number;
  goalsSaves?: number;
  shotsTotal?: number;
  shotsOn?: number;
  passesTotal?: number;
  passesKey?: number;
  passesAccuracy?: number;
  tacklesTotal?: number;
  tacklesBlocks?: number;
  tacklesInterceptions?: number;
  duelsTotal?: number;
  duelsWon?: number;
  dribblesAttempts?: number;
  dribblesSuccess?: number;
  foulsDrawn?: number;
  foulsCommitted?: number;
  cardsYellow?: number;
  cardsYellowRed?: number;
  cardsRed?: number;
  penaltyWon?: number;
  penaltyCommitted?: number;
  penaltyScored?: number;
  penaltyMissed?: number;
  penaltySaved?: number;
}

export interface ExternalPlayer {
  externalId: number;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate?: string;
  height?: number;
  weight?: number;
  photo?: string;
  position?: string; // Goalkeeper/Defender/Midfielder/Attacker
  /** Oyuncunun o sezon oynadığı tüm competition'lardaki istatistikleri. */
  statistics: ExternalPlayerStat[];
}

/**
 * /players/squads girdisi — kayıtlı güncel kadro. /players'tan FARKLI: sezon
 * istatistiği olmayan (0 dakika) oyuncuları da içerir ama veri fakir
 * (tek parça isim, uyruk/doğum/boy yok). Stat'lı oyuncu /players'tan zenginleşir.
 */
export interface ExternalSquadPlayer {
  externalId: number;
  name: string;
  position?: string;
  photo?: string;
  number?: number;
}

export interface ExternalTransfer {
  playerExtId: number;
  date: string;
  fromTeamExtId: number;
  toTeamExtId: number;
  /** API `type` parse edilir: "€ 2.5M" → 2_500_000. Free/Loan/N-A → 0. */
  feeAmount: number;
  feeCurrency: string;
}

export interface IFootballDataClient {
  /** Tüm liglerin meta + current sezon indeksi (TEK istek). Full sync girişi. */
  getLeaguesIndex(): Promise<ExternalLeagueMeta[]>;
  /** Tek lig meta + current sezon (`/leagues?id=`). Tek-lig sync yolu. */
  getLeague(externalId: number): Promise<ExternalLeagueMeta | null>;
  getTeamsByLeague(
    leagueExternalId: number,
    season: number,
  ): Promise<ExternalTeam[]>;
  getPlayersByTeam(
    teamExternalId: number,
    season: number,
    page: number,
  ): Promise<{ items: ExternalPlayer[]; totalPages: number }>;
  /** Kayıtlı güncel kadro (sezon istatistiği olmayanlar dahil; sezon parametresiz). */
  getSquad(teamExternalId: number): Promise<ExternalSquadPlayer[]>;
  getTransfersByTeam(teamExternalId: number): Promise<ExternalTransfer[]>;
}
