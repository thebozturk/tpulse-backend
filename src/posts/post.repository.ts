import { Prisma } from '@prisma/client';

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export const postInclude = {
  owner: {
    select: {
      username: true,
      profilePic: true,
      isMailConfirm: true,
      role: true,
      verificationType: true,
    },
  },
  player: {
    select: {
      firstName: true,
      firstNameTr: true,
      lastName: true,
      lastNameTr: true,
      nationality: true,
      photo: true,
    },
  },
  team: { select: { name: true, nameTr: true, logo: true } },
  fromTeam: { select: { name: true, nameTr: true, logo: true } },
  toTeam: { select: { name: true, nameTr: true, logo: true } },
} satisfies Prisma.PostInclude;

export type PostWithRel = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

export interface PostFavouriteTargets {
  playerIds: string[];
  teamIds: string[];
  reporterUserIds: string[];
}

export interface PostFilter {
  playerId?: string;
  teamId?: string;
  ownerId?: string;
  search?: string;
  favouriteTargets?: PostFavouriteTargets;
  /** Feed bastırma: engellenen/susturulan yazarların id'leri (notIn). */
  suppressedAuthorIds?: string[];
  /** Susturulan kelimeler: content'inde bunlardan birini içeren post elenir. */
  mutedKeywords?: string[];
  page: number;
  pageSize: number;
}

export interface VoteOutcome {
  status: 'NotFound' | 'Disabled' | 'Unchanged' | 'Applied';
  agreeCount: number;
  disagreeCount: number;
  userVote?: number;
}

export interface UpdatePostData {
  content: string;
  playerId?: string;
  teamId?: string;
  fromTeamId?: string;
  toTeamId?: string;
}

export interface IPostRepository {
  feed(filter: PostFilter): Promise<{ items: PostWithRel[]; total: number }>;
  getById(id: string): Promise<PostWithRel | null>;
  getByOwner(ownerId: string): Promise<PostWithRel[]>;
  getByPlayer(playerId: string): Promise<PostWithRel[]>;
  getByTeam(teamId: string): Promise<PostWithRel[]>;
  newCountAfter(afterPostId: string): Promise<number>;
  getOwnerAndType(
    id: string,
  ): Promise<{ ownerId: string; postType: number } | null>;
  update(id: string, data: UpdatePostData): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  isLiked(postId: string, userId: string): Promise<boolean>;
  getLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>>;
  getUserVotes(userId: string, postIds: string[]): Promise<Map<string, number>>;
  vote(postId: string, userId: string, choice: number): Promise<VoteOutcome>;
}
