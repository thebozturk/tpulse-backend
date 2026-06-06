import { Prisma } from '@prisma/client';

export const LEAGUE_REPOSITORY = Symbol('LEAGUE_REPOSITORY');

/** Prisma League + teamCount (agg). Mapper bunu LeagueDto'ya düzleştirir. */
export type LeagueWithCount = Prisma.LeagueGetPayload<{
  include: { _count: { select: { teams: true } } };
}>;

export interface LeagueWriteInput {
  name: string;
  country: string;
  countryLogo: string;
  leagueLogo: string;
  leagueCode?: string;
}

export interface ILeagueRepository {
  getAll(
    page: number,
    pageSize: number,
  ): Promise<{ items: LeagueWithCount[]; total: number }>;
  getById(id: string): Promise<LeagueWithCount | null>;
  getByCode(code: string): Promise<LeagueWithCount | null>;
  create(data: LeagueWriteInput): Promise<{ id: string }>;
  update(id: string, data: LeagueWriteInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  updateImage(
    id: string,
    url: string | null,
    locked: boolean,
  ): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}
