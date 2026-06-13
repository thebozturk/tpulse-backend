import { Prisma } from '@prisma/client';

export const PLAYER_REPOSITORY = Symbol('PLAYER_REPOSITORY');

export type PlayerWithRel = Prisma.PlayerGetPayload<{
  include: {
    team: { select: { name: true; nameTr: true; logo: true } };
    position: { select: { nameEn: true } };
  };
}>;

/** Tekil futbolcu GET'i — temel ilişkiler + tüm lig×sezon istatistikleri. */
export type PlayerDetailWithRel = Prisma.PlayerGetPayload<{
  include: {
    team: { select: { name: true; nameTr: true; logo: true } };
    position: { select: { nameEn: true } };
    statistics: {
      include: {
        league: { select: { name: true; nameTr: true; leagueLogo: true } };
        team: { select: { name: true; nameTr: true; logo: true } };
      };
    };
  };
}>;

export interface PlayerFilter {
  leagueId?: string;
  teamId?: string;
  nationality?: string;
  positionId?: string;
  isFree?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface PlayerWriteInput {
  firstName: string;
  lastName: string;
  firstNameTr?: string;
  lastNameTr?: string;
  nationality: string;
  birthDate?: Date;
  height?: number;
  weight?: number;
  photo?: string;
  birthPlace?: string;
  birthCountry?: string;
  isFree: boolean;
  teamId: string;
  positionId?: string;
}

export interface IPlayerRepository {
  getAll(
    filter: PlayerFilter,
  ): Promise<{ items: PlayerWithRel[]; total: number }>;
  getById(id: string): Promise<PlayerDetailWithRel | null>;
  getByTeamId(teamId: string): Promise<PlayerWithRel[]>;
  getByNationality(nationality: string): Promise<PlayerWithRel[]>;
  getFreeAgents(): Promise<PlayerWithRel[]>;
  create(data: PlayerWriteInput): Promise<{ id: string }>;
  update(id: string, data: PlayerWriteInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  updateImage(
    id: string,
    url: string | null,
    locked: boolean,
  ): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}
