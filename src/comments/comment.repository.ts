import { Prisma } from '@prisma/client';

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');

export const commentInclude = {
  owner: { select: { username: true, profilePic: true } },
} satisfies Prisma.CommentInclude;

export type CommentWithOwner = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

export interface CommentAdminFilter {
  ownerId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface ICommentRepository {
  getByPostId(postId: string): Promise<CommentWithOwner[]>;
  getOwner(id: string): Promise<string | null>;
  update(id: string, content: string): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  postExists(postId: string): Promise<boolean>;
  getLikedCommentIds(userId: string, ids: string[]): Promise<Set<string>>;
  adminList(
    filter: CommentAdminFilter,
  ): Promise<{ items: CommentWithOwner[]; total: number }>;
}
