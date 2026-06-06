import { Prisma } from '@prisma/client';

export const TEAM_REPOSITORY = Symbol('TEAM_REPOSITORY');

export type TeamWithRel = Prisma.TeamGetPayload<{
  include: {
    league: { select: { name: true } };
    _count: { select: { players: true } };
  };
}>;

export type TeamDetailWithRel = Prisma.TeamGetPayload<{
  include: {
    league: { select: { name: true; leagueLogo: true } };
    players: { include: { position: { select: { nameEn: true } } } };
    _count: { select: { players: true } };
  };
}>;

export interface ITeamRepository {
  getAll(
    page: number,
    pageSize: number,
  ): Promise<{ items: TeamWithRel[]; total: number }>;
  getById(id: string): Promise<TeamWithRel | null>;
  getByLeagueId(leagueId: string): Promise<TeamWithRel[]>;
  getDetailById(id: string): Promise<TeamDetailWithRel | null>;
}
