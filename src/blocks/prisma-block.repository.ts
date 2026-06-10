import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { IBlockRepository, MutedKeywordRow } from './block.repository';

@Injectable()
export class PrismaBlockRepository implements IBlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedId: string): Promise<boolean> {
    try {
      await this.prisma.userBlock.create({ data: { blockerId, blockedId } });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return false;
      }
      throw err;
    }
  }

  async unblock(blockerId: string, blockedId: string): Promise<boolean> {
    const { count } = await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
    return count > 0;
  }

  async mute(muterId: string, mutedId: string): Promise<boolean> {
    try {
      await this.prisma.userMute.create({ data: { muterId, mutedId } });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return false;
      }
      throw err;
    }
  }

  async unmute(muterId: string, mutedId: string): Promise<boolean> {
    const { count } = await this.prisma.userMute.deleteMany({
      where: { muterId, mutedId },
    });
    return count > 0;
  }

  async userExists(userId: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id: userId } })) > 0;
  }

  async getSuppressedAuthorIds(userId: string): Promise<string[]> {
    const [blocks, mutes] = await Promise.all([
      this.prisma.userBlock.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
      this.prisma.userMute.findMany({
        where: { muterId: userId },
        select: { mutedId: true },
      }),
    ]);
    return [
      ...new Set([
        ...blocks.map((b) => b.blockedId),
        ...mutes.map((m) => m.mutedId),
      ]),
    ];
  }

  async addKeyword(
    userId: string,
    keyword: string,
  ): Promise<MutedKeywordRow | null> {
    try {
      const row = await this.prisma.mutedKeyword.create({
        data: { userId, keyword },
        select: { id: true, keyword: true },
      });
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }
  }

  async removeKeyword(userId: string, keywordId: string): Promise<boolean> {
    const { count } = await this.prisma.mutedKeyword.deleteMany({
      where: { id: keywordId, userId },
    });
    return count > 0;
  }

  getKeywords(userId: string): Promise<MutedKeywordRow[]> {
    return this.prisma.mutedKeyword.findMany({
      where: { userId },
      select: { id: true, keyword: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMutedKeywordStrings(userId: string): Promise<string[]> {
    const rows = await this.prisma.mutedKeyword.findMany({
      where: { userId },
      select: { keyword: true },
    });
    return rows.map((r) => r.keyword);
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
