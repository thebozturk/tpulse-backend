import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toSkipTake } from '../common/pagination';
import {
  IPlayerRepository,
  PlayerFilter,
  PlayerWithRel,
  PlayerWriteInput,
} from './player.repository';

function isNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}

function mapWriteError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    throw new NotFoundException('Takım veya pozisyon bulunamadı');
  }
  throw e;
}

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

  async create(data: PlayerWriteInput): Promise<{ id: string }> {
    try {
      const player = await this.prisma.player.create({ data });
      return { id: player.id };
    } catch (e) {
      mapWriteError(e);
    }
  }

  async update(id: string, data: PlayerWriteInput): Promise<boolean> {
    try {
      await this.prisma.player.update({ where: { id }, data });
      return true;
    } catch (e) {
      if (isNotFound(e)) {
        return false;
      }
      mapWriteError(e);
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.player.delete({ where: { id } });
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
      await this.prisma.player.update({
        where: { id },
        data: { photo: url, photoLockedByAdmin: locked },
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
    return (await this.prisma.player.count({ where: { id } })) > 0;
  }
}
