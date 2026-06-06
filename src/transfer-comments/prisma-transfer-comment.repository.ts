import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  ITransferCommentRepository,
  TransferCommentWithOwner,
  tcInclude,
} from './transfer-comment.repository';

function isUnique(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

@Injectable()
export class PrismaTransferCommentRepository implements ITransferCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  getByTransferId(transferId: string): Promise<TransferCommentWithOwner[]> {
    return this.prisma.transferComment.findMany({
      where: { transferId },
      orderBy: { createdAtUtc: 'asc' },
      include: tcInclude,
    });
  }

  async create(
    transferId: string,
    ownerId: string,
    content: string,
    parentId?: string,
  ): Promise<{ id: string }> {
    const c = await this.prisma.transferComment.create({
      data: { transferId, ownerId, content, parentId },
    });
    return { id: c.id };
  }

  async getOwner(id: string): Promise<string | null> {
    const c = await this.prisma.transferComment.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    return c?.ownerId ?? null;
  }

  async update(id: string, content: string): Promise<void> {
    await this.prisma.transferComment.update({
      where: { id },
      data: { content },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transferComment.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.transferComment.count({ where: { id } })) > 0;
  }

  async transferExists(transferId: string): Promise<boolean> {
    return (
      (await this.prisma.transfer.count({
        where: { id: transferId, isDeleted: false },
      })) > 0
    );
  }

  async like(commentId: string, userId: string): Promise<void> {
    try {
      await this.prisma.transferCommentLike.create({
        data: { transferCommentId: commentId, userId },
      });
      await this.prisma.transferComment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      });
    } catch (e) {
      if (!isUnique(e)) {
        throw e;
      }
    }
  }

  async unlike(commentId: string, userId: string): Promise<void> {
    const { count } = await this.prisma.transferCommentLike.deleteMany({
      where: { transferCommentId: commentId, userId },
    });
    if (count > 0) {
      await this.prisma.transferComment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
    }
  }

  async getLikedCommentIds(
    userId: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const likes = await this.prisma.transferCommentLike.findMany({
      where: { userId, transferCommentId: { in: ids } },
      select: { transferCommentId: true },
    });
    return new Set(likes.map((l) => l.transferCommentId));
  }
}
