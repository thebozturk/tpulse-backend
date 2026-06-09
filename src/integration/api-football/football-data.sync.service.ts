import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncRunStatus } from '../../common/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheTag } from '../../common/redis/cache-tags';
import { CacheService } from '../../common/redis/cache.service';
import { ImageMirrorService } from '../../storage/image-mirror.service';
import {
  ExternalLeague,
  FOOTBALL_DATA_CLIENT,
  IFootballDataClient,
} from './football-data.client';
import { POSITIONS, positionCode } from './positions';

interface Counts {
  leaguesProcessed: number;
  leaguesInserted: number;
  leaguesUpdated: number;
  teamsInserted: number;
  teamsUpdated: number;
  playersInserted: number;
  playersUpdated: number;
  positionsCreated: number;
  transfersCreated: number;
  transfersUpdated: number;
  playersMarkedFree: number;
  errorCount: number;
  errors: string[];
}

function emptyCounts(): Counts {
  return {
    leaguesProcessed: 0,
    leaguesInserted: 0,
    leaguesUpdated: 0,
    teamsInserted: 0,
    teamsUpdated: 0,
    playersInserted: 0,
    playersUpdated: 0,
    positionsCreated: 0,
    transfersCreated: 0,
    transfersUpdated: 0,
    playersMarkedFree: 0,
    errorCount: 0,
    errors: [],
  };
}

@Injectable()
export class FootballDataSyncService {
  private readonly logger = new Logger(FootballDataSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FOOTBALL_DATA_CLIENT)
    private readonly client: IFootballDataClient,
    private readonly config: ConfigService,
    private readonly mirror: ImageMirrorService,
    private readonly cache: CacheService,
  ) {}

  getRuns(take: number) {
    return this.prisma.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take,
    });
  }

  async syncAll(leagueExternalId?: number): Promise<string> {
    const season = this.config.getOrThrow<number>('apiFootball.season');
    const leagueIds = leagueExternalId
      ? [leagueExternalId]
      : this.config.getOrThrow<number[]>('apiFootball.leagueIds');

    const startedAt = new Date();
    const counts = emptyCounts();
    const syncedLeagueDbIds: string[] = [];
    const seenPlayerExtIds: number[] = [];
    let fatalError: string | undefined;

    try {
      const positions = await this.ensurePositions(counts);
      for (const extId of leagueIds) {
        try {
          const dbId = await this.syncLeague(
            extId,
            season,
            counts,
            positions,
            seenPlayerExtIds,
          );
          if (dbId) {
            syncedLeagueDbIds.push(dbId);
            counts.leaguesProcessed++;
          }
        } catch (e) {
          counts.errorCount++;
          counts.errors.push(`league ${extId}: ${msg(e)}`);
        }
      }
      counts.playersMarkedFree = await this.markFreeAgents(
        syncedLeagueDbIds,
        seenPlayerExtIds,
      );
    } catch (e) {
      fatalError = msg(e);
    }

    const completedAt = new Date();
    const status = fatalError
      ? SyncRunStatus.Failed
      : counts.errorCount > 0
        ? SyncRunStatus.Partial
        : SyncRunStatus.Success;

    const run = await this.prisma.syncRun.create({
      data: {
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status,
        leaguesProcessed: counts.leaguesProcessed,
        leaguesInserted: counts.leaguesInserted,
        leaguesUpdated: counts.leaguesUpdated,
        teamsInserted: counts.teamsInserted,
        teamsUpdated: counts.teamsUpdated,
        playersInserted: counts.playersInserted,
        playersUpdated: counts.playersUpdated,
        positionsCreated: counts.positionsCreated,
        transfersCreated: counts.transfersCreated,
        playersMarkedFree: counts.playersMarkedFree,
        errorCount: counts.errorCount,
        errors: counts.errors.length ? counts.errors.join('\n') : null,
        fatalError,
      },
    });
    this.logger.log(
      `Sync ${run.id}: transfers created=${counts.transfersCreated} feeUpdated=${counts.transfersUpdated}`,
    );
    await this.invalidateChangedCaches(counts);
    return run.id;
  }

  /** Sync sonunda yalnızca gerçekten değişen domain tag'lerini bir kez invalidate eder. */
  private async invalidateChangedCaches(counts: Counts): Promise<void> {
    const tags: string[] = [];
    if (counts.leaguesInserted + counts.leaguesUpdated > 0) {
      tags.push(CacheTag.Leagues);
    }
    if (counts.teamsInserted + counts.teamsUpdated > 0) {
      tags.push(CacheTag.Teams);
    }
    if (
      counts.playersInserted +
        counts.playersUpdated +
        counts.playersMarkedFree >
      0
    ) {
      tags.push(CacheTag.Players);
    }
    if (counts.transfersCreated + counts.transfersUpdated > 0) {
      tags.push(CacheTag.Transfers);
    }
    if (tags.length > 0) {
      await this.cache.invalidateTags(...tags);
    }
  }

  private async ensurePositions(counts: Counts): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const pos of POSITIONS) {
      const existing = await this.prisma.position.findFirst({
        where: { codeEn: pos.codeEn },
        select: { id: true },
      });
      if (existing) {
        map.set(pos.codeEn, existing.id);
      } else {
        const created = await this.prisma.position.create({ data: pos });
        counts.positionsCreated++;
        map.set(pos.codeEn, created.id);
      }
    }
    return map;
  }

  private async syncLeague(
    leagueExtId: number,
    season: number,
    counts: Counts,
    positions: Map<string, string>,
    seen: number[],
  ): Promise<string | null> {
    const extLeague = await this.client.getLeague(leagueExtId, season);
    if (!extLeague) {
      return null;
    }
    const leagueId = await this.upsertLeague(extLeague, counts);

    const teams = await this.client.getTeamsByLeague(leagueExtId, season);
    for (const t of teams) {
      try {
        await this.syncTeam(t, leagueId, season, counts, positions, seen);
      } catch (e) {
        counts.errorCount++;
        counts.errors.push(`team ${t.externalId}: ${msg(e)}`);
      }
    }
    return leagueId;
  }

  private async syncTeam(
    t: import('./football-data.client').ExternalTeam,
    leagueId: string,
    season: number,
    counts: Counts,
    positions: Map<string, string>,
    seen: number[],
  ): Promise<void> {
    const teamId = await this.upsertTeam(t, leagueId, counts);
    let page = 1;
    let totalPages = 1;
    do {
      const { items, totalPages: tp } = await this.client.getPlayersByTeam(
        t.externalId,
        season,
        page,
      );
      totalPages = tp;
      for (const pl of items) {
        seen.push(pl.externalId);
        try {
          await this.upsertPlayer(pl, teamId, positions, counts);
        } catch (e) {
          counts.errorCount++;
          counts.errors.push(`player ${pl.externalId}: ${msg(e)}`);
        }
      }
      page++;
    } while (page <= totalPages);

    if (this.config.get<boolean>('apiFootball.detectTransfers')) {
      await this.syncTransfers(t.externalId, counts);
    }
  }

  private async upsertLeague(
    ext: ExternalLeague,
    counts: Counts,
  ): Promise<string> {
    const existing = await this.prisma.league.findUnique({
      where: { externalId: ext.externalId },
    });
    const logo = await this.resolveImage(
      'leagues',
      ext.externalId,
      ext.leagueLogo,
      existing?.leagueLogoSourceUrl,
      existing?.logoLockedByAdmin,
    );
    if (existing) {
      counts.leaguesUpdated++;
      await this.prisma.league.update({
        where: { id: existing.id },
        data: {
          name: ext.name,
          country: ext.country,
          countryLogo: ext.countryLogo,
          ...(logo
            ? { leagueLogo: logo.url, leagueLogoSourceUrl: logo.source }
            : {}),
        },
      });
      return existing.id;
    }
    counts.leaguesInserted++;
    const created = await this.prisma.league.create({
      data: {
        externalId: ext.externalId,
        name: ext.name,
        country: ext.country,
        countryLogo: ext.countryLogo,
        leagueLogo: logo?.url ?? ext.leagueLogo,
        leagueLogoSourceUrl: ext.leagueLogo,
      },
    });
    return created.id;
  }

  private async upsertTeam(
    ext: import('./football-data.client').ExternalTeam,
    leagueId: string,
    counts: Counts,
  ): Promise<string> {
    const existing = await this.prisma.team.findUnique({
      where: { externalId: ext.externalId },
    });
    const logo = await this.resolveImage(
      'teams',
      ext.externalId,
      ext.logo,
      existing?.logoSourceUrl,
      existing?.logoLockedByAdmin,
    );
    const base = {
      name: ext.name,
      founded: ext.founded,
      venueName: ext.venueName,
      venueCity: ext.venueCity,
      venueCapacity: ext.venueCapacity,
      leagueId,
    };
    if (existing) {
      counts.teamsUpdated++;
      await this.prisma.team.update({
        where: { id: existing.id },
        data: {
          ...base,
          ...(logo ? { logo: logo.url, logoSourceUrl: logo.source } : {}),
        },
      });
      return existing.id;
    }
    counts.teamsInserted++;
    const created = await this.prisma.team.create({
      data: {
        externalId: ext.externalId,
        ...base,
        logo: logo?.url ?? ext.logo,
        logoSourceUrl: ext.logo,
      },
    });
    return created.id;
  }

  private async upsertPlayer(
    ext: import('./football-data.client').ExternalPlayer,
    teamId: string,
    positions: Map<string, string>,
    counts: Counts,
  ): Promise<void> {
    const code = positionCode(ext.position);
    const positionId = code ? positions.get(code) : undefined;
    const existing = await this.prisma.player.findUnique({
      where: { externalId: ext.externalId },
      select: { id: true, photoSourceUrl: true, photoLockedByAdmin: true },
    });
    const photo = await this.resolveImage(
      'players',
      ext.externalId,
      ext.photo,
      existing?.photoSourceUrl,
      existing?.photoLockedByAdmin,
    );
    const base = {
      firstName: ext.firstName,
      lastName: ext.lastName,
      nationality: ext.nationality,
      birthDate: ext.birthDate ? new Date(ext.birthDate) : undefined,
      height: ext.height,
      weight: ext.weight,
      teamId,
      positionId,
      isFree: false,
    };
    if (existing) {
      counts.playersUpdated++;
      await this.prisma.player.update({
        where: { id: existing.id },
        data: {
          ...base,
          ...(photo ? { photo: photo.url, photoSourceUrl: photo.source } : {}),
        },
      });
      return;
    }
    counts.playersInserted++;
    await this.prisma.player.create({
      data: {
        externalId: ext.externalId,
        ...base,
        photo: photo?.url ?? ext.photo,
        photoSourceUrl: ext.photo,
      },
    });
  }

  private async syncTransfers(
    teamExtId: number,
    counts: Counts,
  ): Promise<void> {
    const transfers = await this.client.getTransfersByTeam(teamExtId);
    for (const tr of transfers) {
      try {
        await this.upsertTransfer(tr, counts);
      } catch (e) {
        counts.errorCount++;
        counts.errors.push(`transfer p${tr.playerExtId}: ${msg(e)}`);
      }
    }
  }

  private async upsertTransfer(
    tr: import('./football-data.client').ExternalTransfer,
    counts: Counts,
  ): Promise<void> {
    const [player, from, to] = await Promise.all([
      this.prisma.player.findUnique({
        where: { externalId: tr.playerExtId },
        select: { id: true },
      }),
      this.prisma.team.findUnique({
        where: { externalId: tr.fromTeamExtId },
        select: { id: true },
      }),
      this.prisma.team.findUnique({
        where: { externalId: tr.toTeamExtId },
        select: { id: true },
      }),
    ]);
    if (!player || !from || !to) {
      return;
    }
    const date = new Date(tr.date);
    const dup = await this.prisma.transfer.findFirst({
      where: {
        playerId: player.id,
        fromTeamId: from.id,
        toTeamId: to.id,
        transferDate: date,
      },
      select: { id: true, feeAmount: true, feeCurrency: true },
    });
    if (dup) {
      // Mevcut kayıt (örn. eski sync'ten 0 bedelli) → bedeli geri doldur/güncelle.
      if (
        Number(dup.feeAmount) !== tr.feeAmount ||
        dup.feeCurrency !== tr.feeCurrency
      ) {
        await this.prisma.transfer.update({
          where: { id: dup.id },
          data: { feeAmount: tr.feeAmount, feeCurrency: tr.feeCurrency },
        });
        counts.transfersUpdated++;
      }
      return;
    }
    await this.prisma.transfer.create({
      data: {
        playerId: player.id,
        fromTeamId: from.id,
        toTeamId: to.id,
        transferDate: date,
        feeAmount: tr.feeAmount,
        feeCurrency: tr.feeCurrency,
        source: 'ApiSports',
      },
    });
    counts.transfersCreated++;
  }

  private async markFreeAgents(
    leagueDbIds: string[],
    seenExtIds: number[],
  ): Promise<number> {
    if (leagueDbIds.length === 0) {
      return 0;
    }
    const { count } = await this.prisma.player.updateMany({
      where: {
        team: { leagueId: { in: leagueDbIds } },
        externalId: { notIn: seenExtIds.length ? seenExtIds : [-1] },
        isFree: false,
      },
      data: { isFree: true },
    });
    return count;
  }

  /**
   * Mirror kararı: locked → değiştirme (undefined). mirrorImages kapalı → ham URL.
   * sourceUrl değişmediyse → değiştirme. Değiştiyse → S3'e mirror.
   */
  private async resolveImage(
    folder: string,
    entityExtId: number,
    sourceUrl: string | null | undefined,
    currentSourceUrl: string | null | undefined,
    locked: boolean | undefined,
  ): Promise<{ url: string; source: string } | undefined> {
    if (locked || !sourceUrl) {
      return undefined;
    }
    if (currentSourceUrl === sourceUrl) {
      return undefined;
    }
    if (!this.config.get<boolean>('apiFootball.mirrorImages')) {
      return { url: sourceUrl, source: sourceUrl };
    }
    try {
      const url = await this.mirror.mirror(
        sourceUrl,
        folder,
        String(entityExtId),
      );
      return { url, source: sourceUrl };
    } catch (e) {
      this.logger.warn(`Mirror başarısız ${folder}/${entityExtId}: ${msg(e)}`);
      return { url: sourceUrl, source: sourceUrl };
    }
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown';
}
