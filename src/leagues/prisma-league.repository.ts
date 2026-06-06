import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import { ILeagueRepository, LeagueWithCount } from './league.repository';

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
}
