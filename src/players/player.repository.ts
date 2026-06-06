import { Prisma } from '@prisma/client';

export const PLAYER_REPOSITORY = Symbol('PLAYER_REPOSITORY');

export type PlayerWithRel = Prisma.PlayerGetPayload<{
  include: {
    team: { select: { name: true; logo: true } };
    position: { select: { nameEn: true } };
  };
}>;

export interface PlayerFilter {
  teamId?: string;
  nationality?: string;
  positionId?: string;
  isFree?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface IPlayerRepository {
  getAll(
    filter: PlayerFilter,
  ): Promise<{ items: PlayerWithRel[]; total: number }>;
  getById(id: string): Promise<PlayerWithRel | null>;
  getByTeamId(teamId: string): Promise<PlayerWithRel[]>;
  getByNationality(nationality: string): Promise<PlayerWithRel[]>;
  getFreeAgents(): Promise<PlayerWithRel[]>;
}
