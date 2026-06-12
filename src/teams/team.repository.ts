import { Prisma } from '@prisma/client';

export const TEAM_REPOSITORY = Symbol('TEAM_REPOSITORY');

export type TeamWithRel = Prisma.TeamGetPayload<{
  include: {
    league: { select: { name: true; nameTr: true } };
    _count: { select: { players: true } };
  };
}>;

export type TeamDetailWithRel = Prisma.TeamGetPayload<{
  include: {
    league: { select: { name: true; nameTr: true; leagueLogo: true } };
    players: {
      include: {
        position: { select: { nameEn: true } };
        statistics: {
          select: {
            leagueId: true;
            season: true;
            appearances: true;
            minutes: true;
            goalsTotal: true;
            goalsAssists: true;
            rating: true;
            cardsYellow: true;
            cardsRed: true;
          };
        };
      };
    };
    _count: { select: { players: true } };
  };
}>;

export interface TeamWriteInput {
  name: string;
  nameTr?: string;
  logo?: string;
  leagueId: string;
}

export interface ITeamRepository {
  getAll(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<{ items: TeamWithRel[]; total: number }>;
  getById(id: string): Promise<TeamWithRel | null>;
  getByLeagueId(leagueId: string): Promise<TeamWithRel[]>;
  getDetailById(id: string): Promise<TeamDetailWithRel | null>;
  create(data: TeamWriteInput): Promise<{ id: string }>;
  update(id: string, data: TeamWriteInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  updateImage(
    id: string,
    url: string | null,
    locked: boolean,
  ): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}
