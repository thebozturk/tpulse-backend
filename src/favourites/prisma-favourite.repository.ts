import { Injectable } from '@nestjs/common';
import { FavouriteType } from '../common/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  FavouriteInput,
  FavouriteTargets,
  IFavouriteRepository,
  ResolvedFavourite,
} from './favourite.repository';

@Injectable()
export class PrismaFavouriteRepository implements IFavouriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getForUserResolved(userId: string): Promise<ResolvedFavourite[]> {
    const favs = await this.prisma.userFavourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const ids = (type: FavouriteType): string[] =>
      favs.filter((f) => f.type === type).map((f) => f.targetId);

    const [leagues, teams, players, users] = await Promise.all([
      this.prisma.league.findMany({
        where: { id: { in: ids(FavouriteType.League) } },
        select: { id: true, name: true, leagueLogo: true },
      }),
      this.prisma.team.findMany({
        where: { id: { in: ids(FavouriteType.Team) } },
        select: { id: true, name: true, logo: true },
      }),
      this.prisma.player.findMany({
        where: { id: { in: ids(FavouriteType.Player) } },
        select: { id: true, firstName: true, lastName: true, photo: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: ids(FavouriteType.Reporter) } },
        select: { id: true, nickname: true, profilePic: true },
      }),
    ]);
    const leagueMap = new Map(leagues.map((l) => [l.id, l]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return favs.map((f) => {
      let name = '';
      let imageUrl: string | undefined;
      switch (f.type) {
        case FavouriteType.League: {
          const l = leagueMap.get(f.targetId);
          name = l?.name ?? '';
          imageUrl = l?.leagueLogo;
          break;
        }
        case FavouriteType.Team: {
          const t = teamMap.get(f.targetId);
          name = t?.name ?? '';
          imageUrl = t?.logo ?? undefined;
          break;
        }
        case FavouriteType.Player: {
          const p = playerMap.get(f.targetId);
          name = p ? `${p.firstName} ${p.lastName}` : '';
          imageUrl = p?.photo ?? undefined;
          break;
        }
        case FavouriteType.Reporter: {
          const u = userMap.get(f.targetId);
          name = u?.nickname ?? '';
          imageUrl = u?.profilePic ?? undefined;
          break;
        }
      }
      return {
        id: f.id,
        type: f.type,
        targetId: f.targetId,
        name,
        imageUrl,
        createdAt: f.createdAt,
      };
    });
  }

  async exists(
    userId: string,
    type: number,
    targetId: string,
  ): Promise<boolean> {
    return (
      (await this.prisma.userFavourite.count({
        where: { userId, type, targetId },
      })) > 0
    );
  }

  async targetExists(type: number, targetId: string): Promise<boolean> {
    switch (type) {
      case FavouriteType.League:
        return (
          (await this.prisma.league.count({ where: { id: targetId } })) > 0
        );
      case FavouriteType.Team:
        return (await this.prisma.team.count({ where: { id: targetId } })) > 0;
      case FavouriteType.Player:
        return (
          (await this.prisma.player.count({ where: { id: targetId } })) > 0
        );
      case FavouriteType.Reporter:
        return (await this.prisma.user.count({ where: { id: targetId } })) > 0;
      default:
        return false;
    }
  }

  async create(
    userId: string,
    type: number,
    targetId: string,
  ): Promise<{ id: string }> {
    const fav = await this.prisma.userFavourite.create({
      data: { userId, type, targetId },
    });
    return { id: fav.id };
  }

  async remove(userId: string, favouriteId: string): Promise<boolean> {
    const { count } = await this.prisma.userFavourite.deleteMany({
      where: { id: favouriteId, userId },
    });
    return count > 0;
  }

  async replaceSet(userId: string, items: FavouriteInput[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userFavourite.deleteMany({ where: { userId } }),
      this.prisma.userFavourite.createMany({
        data: items.map((i) => ({
          userId,
          type: i.type,
          targetId: i.targetId,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async getTargets(userId: string): Promise<FavouriteTargets> {
    const favs = await this.prisma.userFavourite.findMany({
      where: { userId },
      select: { type: true, targetId: true },
    });
    const playerIds = favs
      .filter((f) => f.type === FavouriteType.Player)
      .map((f) => f.targetId);
    const teamIds = favs
      .filter((f) => f.type === FavouriteType.Team)
      .map((f) => f.targetId);
    const reporterUserIds = favs
      .filter((f) => f.type === FavouriteType.Reporter)
      .map((f) => f.targetId);
    const leagueIds = favs
      .filter((f) => f.type === FavouriteType.League)
      .map((f) => f.targetId);

    // Lig favorisi → ligin takım id'lerine genişler (docs/00 §6)
    if (leagueIds.length > 0) {
      const teams = await this.prisma.team.findMany({
        where: { leagueId: { in: leagueIds } },
        select: { id: true },
      });
      teamIds.push(...teams.map((t) => t.id));
    }
    return { playerIds, teamIds: [...new Set(teamIds)], reporterUserIds };
  }
}
