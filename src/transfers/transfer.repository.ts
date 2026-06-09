import { Prisma } from '@prisma/client';

export const TRANSFER_REPOSITORY = Symbol('TRANSFER_REPOSITORY');

export const transferInclude = {
  player: {
    include: {
      position: { select: { nameEn: true } },
      team: { select: { name: true } },
    },
  },
  fromTeam: { select: { id: true, name: true, logo: true } },
  toTeam: { select: { id: true, name: true, logo: true } },
  createdByUser: {
    select: { id: true, username: true, profilePic: true, role: true },
  },
} satisfies Prisma.TransferInclude;

export type TransferWithRel = Prisma.TransferGetPayload<{
  include: typeof transferInclude;
}>;

export interface TransferFilter {
  playerId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  ownerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  feeMin?: number;
  feeMax?: number;
  currency?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

export type Paged<T> = { items: T[]; total: number };

export interface ITransferRepository {
  // Genel sorgu (isRumour ile transfer/rumour ayrımı)
  query(
    filter: TransferFilter,
    isRumour: boolean,
  ): Promise<Paged<TransferWithRel>>;
  getById(id: string, isRumour: boolean): Promise<TransferWithRel | null>;
  getLatest(
    page: number,
    pageSize: number,
    isRumour: boolean,
  ): Promise<Paged<TransferWithRel>>;
  getTopExpensive(
    currency: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paged<TransferWithRel>>;
  getBetweenTeams(
    fromTeamId: string,
    toTeamId: string,
    includeReverse: boolean,
  ): Promise<TransferWithRel[]>;
  getByYear(year: number): Promise<TransferWithRel[]>;
  getByMonth(year: number, month: number): Promise<TransferWithRel[]>;

  // Lig
  getByLeagueId(
    leagueId: string,
    year: number | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paged<TransferWithRel>>;
  getLatestByLeagueId(
    leagueId: string,
    take: number,
    year?: number,
  ): Promise<TransferWithRel[]>;
  getLeagueDirectional(
    leagueId: string,
    direction: 'incoming' | 'outgoing',
    filter: TransferFilter,
  ): Promise<Paged<TransferWithRel>>;
  getLatestByAllLeagues(
    take: number,
    year?: number,
  ): Promise<
    Array<{
      league: { id: string; name: string; leagueLogo: string };
      transfers: TransferWithRel[];
    }>
  >;

  // Takım
  getByTeamDirectional(
    teamId: string,
    direction: 'incoming' | 'outgoing' | 'all',
  ): Promise<TransferWithRel[]>;
  getRecentByTeam(
    teamId: string,
    direction: 'incoming' | 'outgoing',
    take: number,
  ): Promise<TransferWithRel[]>;

  // Oyuncu
  getByPlayerId(playerId: string): Promise<TransferWithRel[]>;
  getLastByPlayerId(playerId: string): Promise<TransferWithRel | null>;

  // Rumour kısayolları (isRumour:true)
  getByPlayerIdRumour(playerId: string): Promise<TransferWithRel[]>;
  getByTeamIdRumour(teamId: string): Promise<TransferWithRel[]>;

  // Admin yazma
  existsDuplicate(
    playerId: string,
    fromTeamId: string,
    toTeamId: string,
    transferDate: Date,
  ): Promise<boolean>;
  createTransfer(
    data: TransferWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  updateTransfer(id: string, data: TransferWriteInput): Promise<boolean>;
  patchTransfer(id: string, data: TransferPatchInput): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;

  // Rumour write (Faz 6b)
  createRumour(
    data: RumourWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  getRumourMeta(
    id: string,
  ): Promise<{ createdByUserId: string | null; isRumour: boolean } | null>;
  updateRumour(id: string, data: RumourUpdateInput): Promise<boolean>;
  confirmRumour(
    id: string,
    data: TransferPatchInput,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;
}

export interface RumourWriteInput {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  feeAmount: number;
  feeCurrency: string;
  createdByUserId: string;
}

export type RumourUpdateInput = Omit<RumourWriteInput, 'createdByUserId'>;

export interface TransferWriteInput {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  transferDate: Date;
  feeAmount: number;
  feeCurrency: string;
  createdByUserId?: string;
}

export interface TransferPatchInput {
  feeAmount?: number;
  feeCurrency?: string;
  transferDate?: Date;
}
