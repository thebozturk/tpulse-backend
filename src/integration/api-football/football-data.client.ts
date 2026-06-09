export const FOOTBALL_DATA_CLIENT = Symbol('FOOTBALL_DATA_CLIENT');

export interface ExternalLeague {
  externalId: number;
  name: string;
  country: string;
  countryLogo: string;
  leagueLogo: string;
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
  getLeague(externalId: number, season: number): Promise<ExternalLeague | null>;
  getTeamsByLeague(
    leagueExternalId: number,
    season: number,
  ): Promise<ExternalTeam[]>;
  getPlayersByTeam(
    teamExternalId: number,
    season: number,
    page: number,
  ): Promise<{ items: ExternalPlayer[]; totalPages: number }>;
  getTransfersByTeam(teamExternalId: number): Promise<ExternalTransfer[]>;
}
