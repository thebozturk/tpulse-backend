import { Prisma } from '@prisma/client';

export const NEWS_REPOSITORY = Symbol('NEWS_REPOSITORY');

export type NewsWithRel = Prisma.NewsGetPayload<{
  include: {
    player: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        nationality: true;
        photo: true;
      };
    };
    fromTeam: { select: { id: true; name: true; logo: true } };
    toTeam: { select: { id: true; name: true; logo: true } };
  };
}>;

export type NewsSort = 'publishDate' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface INewsRepository {
  getAll(
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getById(id: string): Promise<NewsWithRel | null>;
  getByPlayerId(
    playerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByToTeamId(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByFromTeamId(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getBySourceName(
    sourceName: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByDateRange(
    start: Date,
    end: Date,
    page: number,
    pageSize: number,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
}
