import { Prisma } from '@prisma/client';

export const LEAGUE_REPOSITORY = Symbol('LEAGUE_REPOSITORY');

/** Prisma League + teamCount (agg). Mapper bunu LeagueDto'ya düzleştirir. */
export type LeagueWithCount = Prisma.LeagueGetPayload<{
  include: { _count: { select: { teams: true } } };
}>;

export interface ILeagueRepository {
  getAll(
    page: number,
    pageSize: number,
  ): Promise<{ items: LeagueWithCount[]; total: number }>;
  getById(id: string): Promise<LeagueWithCount | null>;
  getByCode(code: string): Promise<LeagueWithCount | null>;
}
