import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CommentAdminFilter,
  CommentWithOwner,
  ICommentRepository,
  commentInclude,
} from './comment.repository';

@Injectable()
export class PrismaCommentRepository implements ICommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  getByPostId(postId: string): Promise<CommentWithOwner[]> {
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAtUtc: 'asc' },
      include: commentInclude,
    });
  }

  async getOwner(id: string): Promise<string | null> {
    const c = await this.prisma.comment.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    return c?.ownerId ?? null;
  }

  async update(id: string, content: string): Promise<void> {
    await this.prisma.comment.update({ where: { id }, data: { content } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.comment.count({ where: { id } })) > 0;
  }

  async postExists(postId: string): Promise<boolean> {
    return (await this.prisma.post.count({ where: { id: postId } })) > 0;
  }

  async getLikedCommentIds(
    userId: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const likes = await this.prisma.commentLike.findMany({
      where: { userId, commentId: { in: ids } },
      select: { commentId: true },
    });
    return new Set(likes.map((l) => l.commentId));
  }

  async adminList(
    filter: CommentAdminFilter,
  ): Promise<{ items: CommentWithOwner[]; total: number }> {
    const where: Prisma.CommentWhereInput = {
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.q
        ? { content: { contains: filter.q, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAtUtc: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items, total };
  }
}
