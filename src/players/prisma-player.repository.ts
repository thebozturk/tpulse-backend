import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  IPlayerRepository,
  PlayerFilter,
  PlayerWithRel,
} from './player.repository';

const include = {
  team: { select: { name: true, logo: true } },
  position: { select: { nameEn: true } },
} satisfies object;

@Injectable()
export class PrismaPlayerRepository implements IPlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(
    filter: PlayerFilter,
  ): Promise<{ items: PlayerWithRel[]; total: number }> {
    const where: Prisma.PlayerWhereInput = {
      teamId: filter.teamId,
      nationality: filter.nationality,
      positionId: filter.positionId,
      isFree: filter.isFree,
      ...(filter.search
        ? {
            OR: [
              { firstName: { contains: filter.search, mode: 'insensitive' } },
              { lastName: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take } = toSkipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include,
      }),
      this.prisma.player.count({ where }),
    ]);
    return { items, total };
  }

  getById(id: string): Promise<PlayerWithRel | null> {
    return this.prisma.player.findUnique({ where: { id }, include });
  }

  getByTeamId(teamId: string): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { teamId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }

  getByNationality(nationality: string): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { nationality },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }

  getFreeAgents(): Promise<PlayerWithRel[]> {
    return this.prisma.player.findMany({
      where: { isFree: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include,
    });
  }
}
