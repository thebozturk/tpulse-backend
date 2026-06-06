import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  ILeagueRepository,
  LeagueWithCount,
  LeagueWriteInput,
} from './league.repository';

function isNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}

const withTeamCount = {
  _count: { select: { teams: true } },
} satisfies object;

@Injectable()
export class PrismaLeagueRepository implements ILeagueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(
    page: number,
    pageSize: number,
  ): Promise<{ items: LeagueWithCount[]; total: number }> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.league.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
        include: withTeamCount,
      }),
      this.prisma.league.count(),
    ]);
    return { items, total };
  }

  getById(id: string): Promise<LeagueWithCount | null> {
    return this.prisma.league.findUnique({
      where: { id },
      include: withTeamCount,
    });
  }

  getByCode(code: string): Promise<LeagueWithCount | null> {
    return this.prisma.league.findFirst({
      where: { leagueCode: code },
      include: withTeamCount,
    });
  }

  async create(data: LeagueWriteInput): Promise<{ id: string }> {
    const league = await this.prisma.league.create({ data });
    return { id: league.id };
  }

  async update(id: string, data: LeagueWriteInput): Promise<boolean> {
    try {
      await this.prisma.league.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.league.delete({ where: { id } });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async updateImage(
    id: string,
    url: string | null,
    locked: boolean,
  ): Promise<boolean> {
    try {
      await this.prisma.league.update({
        where: { id },
        data: { leagueLogo: url ?? '', logoLockedByAdmin: locked },
      });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      throw e;
    }
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.league.count({ where: { id } })) > 0;
  }
}
