import { Prisma } from '@prisma/client';

export const NEWS_REPOSITORY = Symbol('NEWS_REPOSITORY');

export type NewsWithRel = Prisma.NewsGetPayload<{
  include: {
    player: {
      select: {
        id: true;
        firstName: true;
        firstNameTr: true;
        lastName: true;
        lastNameTr: true;
        nationality: true;
        photo: true;
      };
    };
    fromTeam: { select: { id: true; name: true; nameTr: true; logo: true } };
    toTeam: { select: { id: true; name: true; nameTr: true; logo: true } };
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
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByToTeamId(
    teamId: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByFromTeamId(
    teamId: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getBySourceName(
    sourceName: string,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  getByDateRange(
    start: Date,
    end: Date,
    page: number,
    pageSize: number,
    sortBy: NewsSort,
    order: SortOrder,
  ): Promise<{ items: NewsWithRel[]; total: number }>;
  create(
    data: NewsWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  update(id: string, data: NewsWriteInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  removeBulk(ids: string[]): Promise<number>;
  updateImage(id: string, url: string | null): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

export interface NewsWriteInput {
  publishDate?: Date;
  playerId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  slug: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  // Bot ingest yansıması için idempotency anahtarı (manuel yazımda undefined).
  sourceId?: string;
  title: string;
  content?: string;
}
