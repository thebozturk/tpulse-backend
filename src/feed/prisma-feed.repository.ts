import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  PostFavouriteTargets,
  PostWithRel,
  postInclude,
} from '../posts/post.repository';
import { IFeedRepository } from './feed.repository';

@Injectable()
export class PrismaFeedRepository implements IFeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  byFavourite(
    targets: PostFavouriteTargets,
    limit: number,
  ): Promise<PostWithRel[]> {
    const or: Prisma.PostWhereInput[] = [];
    if (targets.playerIds.length) {
      or.push({ playerId: { in: targets.playerIds } });
    }
    if (targets.teamIds.length) {
      or.push({ teamId: { in: targets.teamIds } });
    }
    if (targets.reporterUserIds.length) {
      or.push({ ownerId: { in: targets.reporterUserIds } });
    }
    if (or.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.post.findMany({
      where: { OR: or },
      orderBy: [{ hotScore: 'desc' }, { createdAtUtc: 'desc' }],
      take: limit,
      include: postInclude,
    });
  }

  byAuthors(authorIds: string[], limit: number): Promise<PostWithRel[]> {
    if (authorIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.post.findMany({
      where: { ownerId: { in: authorIds } },
      orderBy: [{ hotScore: 'desc' }, { createdAtUtc: 'desc' }],
      take: limit,
      include: postInclude,
    });
  }
}
