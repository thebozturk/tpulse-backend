import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostVoteChoice } from '../common/enums';
import { toSkipTake } from '../common/pagination';
import {
  IPostRepository,
  PostFilter,
  PostWithRel,
  UpdatePostData,
  VoteOutcome,
  postInclude,
} from './post.repository';

@Injectable()
export class PrismaPostRepository implements IPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async feed(
    filter: PostFilter,
  ): Promise<{ items: PostWithRel[]; total: number }> {
    const where: Prisma.PostWhereInput = {
      playerId: filter.playerId,
      teamId: filter.teamId,
      ownerId: filter.ownerId,
      ...(filter.search
        ? { content: { contains: filter.search, mode: 'insensitive' } }
        : {}),
      ...(filter.favouriteTargets
        ? {
            OR: [
              { playerId: { in: filter.favouriteTargets.playerIds } },
              { teamId: { in: filter.favouriteTargets.teamIds } },
              { ownerId: { in: filter.favouriteTargets.reporterUserIds } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAtUtc: 'desc' }, { id: 'desc' }],
        include: postInclude,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total };
  }

  getById(id: string): Promise<PostWithRel | null> {
    return this.prisma.post.findUnique({ where: { id }, include: postInclude });
  }

  getByOwner(ownerId: string): Promise<PostWithRel[]> {
    return this.prisma.post.findMany({
      where: { ownerId },
      orderBy: [{ createdAtUtc: 'desc' }, { id: 'desc' }],
      include: postInclude,
    });
  }

  getByPlayer(playerId: string): Promise<PostWithRel[]> {
    return this.prisma.post.findMany({
      where: { playerId },
      orderBy: [{ createdAtUtc: 'desc' }, { id: 'desc' }],
      include: postInclude,
    });
  }

  getByTeam(teamId: string): Promise<PostWithRel[]> {
    return this.prisma.post.findMany({
      where: { teamId },
      orderBy: [{ createdAtUtc: 'desc' }, { id: 'desc' }],
      include: postInclude,
    });
  }

  async newCountAfter(afterPostId: string): Promise<number> {
    const after = await this.prisma.post.findUnique({
      where: { id: afterPostId },
      select: { createdAtUtc: true },
    });
    if (!after) {
      return 0;
    }
    return this.prisma.post.count({
      where: { createdAtUtc: { gt: after.createdAtUtc } },
    });
  }

  getOwnerAndType(
    id: string,
  ): Promise<{ ownerId: string; postType: number } | null> {
    return this.prisma.post.findUnique({
      where: { id },
      select: { ownerId: true, postType: true },
    });
  }

  async update(id: string, data: UpdatePostData): Promise<void> {
    await this.prisma.post.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.post.count({ where: { id } })) > 0;
  }

  async isLiked(postId: string, userId: string): Promise<boolean> {
    const like = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });
    return like !== null;
  }

  async getLikedPostIds(
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (postIds.length === 0) {
      return new Set();
    }
    const likes = await this.prisma.postLike.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(likes.map((l) => l.postId));
  }

  async getUserVotes(
    userId: string,
    postIds: string[],
  ): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }
    const votes = await this.prisma.postVote.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true, choice: true },
    });
    return new Map(votes.map((v) => [v.postId, v.choice]));
  }

  async vote(
    postId: string,
    userId: string,
    choice: number,
  ): Promise<VoteOutcome> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { isVotingEnabled: true, agreeCount: true, disagreeCount: true },
    });
    if (!post) {
      return { status: 'NotFound', agreeCount: 0, disagreeCount: 0 };
    }
    if (!post.isVotingEnabled) {
      return {
        status: 'Disabled',
        agreeCount: post.agreeCount,
        disagreeCount: post.disagreeCount,
      };
    }

    const existing = await this.prisma.postVote.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { choice: true },
    });
    if (existing?.choice === choice) {
      return {
        status: 'Unchanged',
        agreeCount: post.agreeCount,
        disagreeCount: post.disagreeCount,
        userVote: choice,
      };
    }

    let agreeDelta = 0;
    let disagreeDelta = 0;
    if (existing) {
      if (existing.choice === PostVoteChoice.Agree) {
        agreeDelta--;
      } else {
        disagreeDelta--;
      }
    }
    if (choice === PostVoteChoice.Agree) {
      agreeDelta++;
    } else {
      disagreeDelta++;
    }

    await this.prisma.$transaction([
      this.prisma.postVote.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, choice },
        update: { choice },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: {
          agreeCount: { increment: agreeDelta },
          disagreeCount: { increment: disagreeDelta },
        },
      }),
    ]);

    return {
      status: 'Applied',
      agreeCount: post.agreeCount + agreeDelta,
      disagreeCount: post.disagreeCount + disagreeDelta,
      userVote: choice,
    };
  }
}
