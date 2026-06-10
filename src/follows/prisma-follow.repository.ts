import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { IFollowRepository } from './follow.repository';

@Injectable()
export class PrismaFollowRepository implements IFollowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(followerId: string, followingId: string): Promise<boolean> {
    try {
      await this.prisma.follow.create({ data: { followerId, followingId } });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return false; // zaten takip ediyor → idempotent
      }
      throw err;
    }
  }

  async remove(followerId: string, followingId: string): Promise<boolean> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    return count > 0;
  }

  async exists(followerId: string, followingId: string): Promise<boolean> {
    const found = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { id: true },
    });
    return found !== null;
  }

  async getFollowingIds(followerId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId },
      select: { followingId: true },
    });
    return rows.map((r) => r.followingId);
  }

  async userExists(userId: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id: userId } })) > 0;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}
