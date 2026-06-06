import { Prisma } from '@prisma/client';

export const TRANSFER_COMMENT_REPOSITORY = Symbol(
  'TRANSFER_COMMENT_REPOSITORY',
);

export const tcInclude = {
  owner: { select: { username: true, profilePic: true } },
} satisfies Prisma.TransferCommentInclude;

export type TransferCommentWithOwner = Prisma.TransferCommentGetPayload<{
  include: typeof tcInclude;
}>;

export interface ITransferCommentRepository {
  getByTransferId(transferId: string): Promise<TransferCommentWithOwner[]>;
  create(
    transferId: string,
    ownerId: string,
    content: string,
    parentId?: string,
  ): Promise<{ id: string }>;
  getOwner(id: string): Promise<string | null>;
  update(id: string, content: string): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  transferExists(transferId: string): Promise<boolean>;
  like(commentId: string, userId: string): Promise<void>;
  unlike(commentId: string, userId: string): Promise<void>;
  getLikedCommentIds(userId: string, ids: string[]): Promise<Set<string>>;
}
