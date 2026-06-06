import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  ITeamRepository,
  TeamDetailWithRel,
  TeamWithRel,
} from './team.repository';

const include = {
  league: { select: { name: true } },
  _count: { select: { players: true } },
} satisfies object;

@Injectable()
export class PrismaTeamRepository implements ITeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(
    page: number,
    pageSize: number,
  ): Promise<{ items: TeamWithRel[]; total: number }> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
        include,
      }),
      this.prisma.team.count(),
    ]);
    return { items, total };
  }

  getById(id: string): Promise<TeamWithRel | null> {
    return this.prisma.team.findUnique({ where: { id }, include });
  }

  getByLeagueId(leagueId: string): Promise<TeamWithRel[]> {
    return this.prisma.team.findMany({
      where: { leagueId },
      orderBy: { name: 'asc' },
      include,
    });
  }

  getDetailById(id: string): Promise<TeamDetailWithRel | null> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        league: { select: { name: true, leagueLogo: true } },
        players: {
          include: { position: { select: { nameEn: true } } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
        _count: { select: { players: true } },
      },
    });
  }
}
