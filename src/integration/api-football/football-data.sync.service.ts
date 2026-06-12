import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncRunStatus } from '../../common/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheTag } from '../../common/redis/cache-tags';
import { CacheService } from '../../common/redis/cache.service';
import { ImageMirrorService } from '../../storage/image-mirror.service';
import { CATALOG_LEAGUE_IDS } from './league-catalog';
import {
  ExternalLeagueMeta,
  ExternalPlayer,
  ExternalPlayerStat,
  ExternalSquadPlayer,
  ExternalTeam,
  FOOTBALL_DATA_CLIENT,
  IFootballDataClient,
  QuotaExhaustedError,
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
  statsUpserted: number;
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
    statsUpserted: 0,
    transfersCreated: 0,
    transfersUpdated: 0,
    playersMarkedFree: 0,
    errorCount: 0,
    errors: [],
  };
}

/** syncAll sonucu — quota tükenirse `remaining` ile kaldığı yerden devam edilir. */
export interface SyncResult {
  runId: string;
  /** Quota nedeniyle işlenemeyen lig external ID'leri (varsa resume edilir). */
  remaining: number[];
}

/** Çalışma boyunca external ID → DB id eşlemeleri ve görülen takım seti. */
interface RunMaps {
  leagueIdByExt: Map<number, string>;
  teamIdByExt: Map<number, string>;
  seenTeams: Set<number>;
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

  /**
   * Curated katalog (veya verilen alt küme) için tam senkron.
   * - Sezon: her ligin /leagues current sezonundan türetilir (global season YOK).
   * - Sıra: lig-tipi önce, kupa-tipi sonra → kulüpler domestik ligine bağlı kalır.
   * - Kupa-tipi: yalnız lig+takım meta; kadro çekilmez (oyuncu kupa statları
   *   zaten kulüp kadrosu /players cevabında gelir, milli takım reassign'ı önlenir).
   * - Quota tükenirse işlenmeyen ligleri `remaining` ile döner (processor erteler).
   */
  async syncAll(opts?: { leagueExternalIds?: number[] }): Promise<SyncResult> {
    const startedAt = new Date();
    const counts = emptyCounts();
    const maps = await this.loadRunMaps();
    const syncedLeagueDbIds: string[] = [];
    const seenPlayerExtIds: number[] = [];
    const remaining: number[] = [];
    let fatalError: string | undefined;
    let quotaHit = false;

    try {
      const index = await this.buildLeagueIndex();
      const positions = await this.ensurePositions(counts);
      const targetIds = this.resolveTargetIds(opts?.leagueExternalIds, index);

      for (let i = 0; i < targetIds.length; i++) {
        const extId = targetIds[i];
        if (quotaHit) {
          remaining.push(extId);
          continue;
        }
        const meta = index.get(extId);
        if (!meta || meta.currentSeason === null) {
          counts.errorCount++;
          counts.errors.push(`league ${extId}: kapsam/sezon yok, atlandı`);
          continue;
        }
        try {
          const dbId = await this.syncLeague(
            meta,
            counts,
            positions,
            maps,
            seenPlayerExtIds,
          );
          if (dbId) {
            counts.leaguesProcessed++;
            if (meta.type === 'League') {
              syncedLeagueDbIds.push(dbId);
            }
          }
        } catch (e) {
          if (e instanceof QuotaExhaustedError) {
            quotaHit = true;
            remaining.push(extId); // bu lig yarım kaldı → tekrar dene
            this.logger.warn(
              `Quota tükendi, ${extId}'den itibaren ertelenecek`,
            );
            continue;
          }
          counts.errorCount++;
          counts.errors.push(`league ${extId}: ${msg(e)}`);
        }
      }

      // Free-agent işaretleme yalnız tam işlenen lig-tipi ligler için güvenli.
      if (!quotaHit) {
        counts.playersMarkedFree = await this.markFreeAgents(
          syncedLeagueDbIds,
          seenPlayerExtIds,
        );
      }
    } catch (e) {
      fatalError = msg(e);
    }

    const runId = await this.persistRun(
      startedAt,
      counts,
      fatalError,
      quotaHit,
    );
    await this.invalidateChangedCaches(counts);
    return { runId, remaining };
  }

  /** Run başında mevcut lig/takım eşlemelerini yükler (stat FK çözümü için). */
  private async loadRunMaps(): Promise<RunMaps> {
    const [leagues, teams] = await Promise.all([
      this.prisma.league.findMany({
        where: { externalId: { not: null } },
        select: { id: true, externalId: true },
      }),
      this.prisma.team.findMany({
        where: { externalId: { not: null } },
        select: { id: true, externalId: true },
      }),
    ]);
    const leagueIdByExt = new Map<number, string>();
    for (const l of leagues) {
      if (l.externalId !== null) leagueIdByExt.set(l.externalId, l.id);
    }
    const teamIdByExt = new Map<number, string>();
    for (const t of teams) {
      if (t.externalId !== null) teamIdByExt.set(t.externalId, t.id);
    }
    return { leagueIdByExt, teamIdByExt, seenTeams: new Set<number>() };
  }

  private async buildLeagueIndex(): Promise<Map<number, ExternalLeagueMeta>> {
    const all = await this.client.getLeaguesIndex();
    const map = new Map<number, ExternalLeagueMeta>();
    for (const m of all) {
      map.set(m.externalId, m);
    }
    return map;
  }

  /** Hedef lig listesi: env override > katalog. Lig-tipi önce, kupa sonra sıralı. */
  private resolveTargetIds(
    explicit: number[] | undefined,
    index: Map<number, ExternalLeagueMeta>,
  ): number[] {
    const configured = this.config.get<number[]>('apiFootball.leagueIds');
    const ids =
      explicit && explicit.length
        ? explicit
        : configured && configured.length
          ? configured
          : [...CATALOG_LEAGUE_IDS];
    const isCup = (id: number) => index.get(id)?.type === 'Cup';
    return [...ids].sort((a, b) => Number(isCup(a)) - Number(isCup(b)));
  }

  private async syncLeague(
    meta: ExternalLeagueMeta,
    counts: Counts,
    positions: Map<string, string>,
    maps: RunMaps,
    seenPlayers: number[],
  ): Promise<string | null> {
    const season = meta.currentSeason as number;
    const leagueId = await this.upsertLeague(meta, counts);
    maps.leagueIdByExt.set(meta.externalId, leagueId);

    const teams = await this.client.getTeamsByLeague(meta.externalId, season);
    for (const t of teams) {
      if (maps.seenTeams.has(t.externalId)) {
        continue; // başka turnuvada görüldü → domestik ligine bağlı kalsın
      }
      maps.seenTeams.add(t.externalId);
      try {
        const teamId = await this.upsertTeam(t, leagueId, meta.type, counts);
        maps.teamIdByExt.set(t.externalId, teamId);
        // Kadro + stat yalnız lig-tipi competition'larda (milli takım reassign'ı önle).
        if (meta.type === 'League') {
          await this.syncSquad(
            t,
            teamId,
            season,
            counts,
            positions,
            maps,
            seenPlayers,
          );
        }
      } catch (e) {
        if (e instanceof QuotaExhaustedError) {
          throw e; // lig seviyesine taşı → kalan ligler resume'a yazılır
        }
        counts.errorCount++;
        counts.errors.push(`team ${t.externalId}: ${msg(e)}`);
      }
    }
    return leagueId;
  }

  private async syncSquad(
    t: ExternalTeam,
    teamId: string,
    season: number,
    counts: Counts,
    positions: Map<string, string>,
    maps: RunMaps,
    seenPlayers: number[],
  ): Promise<void> {
    const seenInPlayers = new Set<number>();
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
        seenPlayers.push(pl.externalId);
        seenInPlayers.add(pl.externalId);
        try {
          const playerId = await this.upsertPlayer(
            pl,
            teamId,
            positions,
            counts,
          );
          await this.upsertStats(playerId, pl.statistics, maps, counts);
        } catch (e) {
          counts.errorCount++;
          counts.errors.push(`player ${pl.externalId}: ${msg(e)}`);
        }
      }
      page++;
    } while (page <= totalPages);

    // Zero-minute boşluğu: /players sezon istatistiği olanı verir. Kayıtlı kadroda
    // olup hiç oynamamış (yeni transfer vb.) oyuncuları /players/squads ile ekle.
    if (this.config.get<boolean>('apiFootball.fetchSquads')) {
      await this.syncSquadRoster(
        t.externalId,
        teamId,
        positions,
        counts,
        seenInPlayers,
        seenPlayers,
      );
    }

    if (this.config.get<boolean>('apiFootball.detectTransfers')) {
      await this.syncTransfers(t.externalId, counts);
    }
  }

  /** /players'ta görünmeyen kadro oyuncularını minimal kayıtla ekler/günceller. */
  private async syncSquadRoster(
    teamExtId: number,
    teamId: string,
    positions: Map<string, string>,
    counts: Counts,
    seenInPlayers: Set<number>,
    seenPlayers: number[],
  ): Promise<void> {
    const squad = await this.client.getSquad(teamExtId);
    for (const sp of squad) {
      if (seenInPlayers.has(sp.externalId)) {
        continue; // zaten /players'tan zengin veriyle işlendi
      }
      seenPlayers.push(sp.externalId);
      try {
        await this.upsertSquadPlayer(sp, teamId, positions, counts);
      } catch (e) {
        counts.errorCount++;
        counts.errors.push(`squad player ${sp.externalId}: ${msg(e)}`);
      }
    }
  }

  private async upsertLeague(
    ext: ExternalLeagueMeta,
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
        nameTr: ext.name, // Türkçe gösterim adı varsayılanı; admin panelden değiştirir, re-sync ezmez.
        country: ext.country,
        countryLogo: ext.countryLogo,
        leagueLogo: logo?.url ?? ext.leagueLogo,
        leagueLogoSourceUrl: ext.leagueLogo,
      },
    });
    return created.id;
  }

  private async upsertTeam(
    ext: ExternalTeam,
    leagueId: string,
    kind: 'League' | 'Cup',
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
    };
    if (existing) {
      counts.teamsUpdated++;
      await this.prisma.team.update({
        where: { id: existing.id },
        data: {
          ...base,
          // Kupa-tipi mevcut takımın leagueId'sini EZMEZ → kulüp domestik ligine bağlı kalır.
          // (örn. Galatasaray UCL'de görülse de Süper Lig'de kalır.)
          ...(kind === 'League' ? { leagueId } : {}),
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
        leagueId, // yeni takım: domestik lig (League) veya yalnız-kupa/milli takım (Cup)
        nameTr: ext.name, // Türkçe gösterim adı varsayılanı; admin panelden değiştirir, re-sync ezmez.
        logo: logo?.url ?? ext.logo,
        logoSourceUrl: ext.logo,
      },
    });
    return created.id;
  }

  private async upsertPlayer(
    ext: ExternalPlayer,
    teamId: string,
    positions: Map<string, string>,
    counts: Counts,
  ): Promise<string> {
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
      return existing.id;
    }
    counts.playersInserted++;
    const created = await this.prisma.player.create({
      data: {
        externalId: ext.externalId,
        ...base,
        firstNameTr: ext.firstName, // Türkçe gösterim adı varsayılanı; admin panelden değiştirir, re-sync ezmez.
        lastNameTr: ext.lastName,
        photo: photo?.url ?? ext.photo,
        photoSourceUrl: ext.photo,
      },
    });
    return created.id;
  }

  /**
   * Kadro-only (0 dakika) oyuncu: VERİ FAKİR (tek parça isim, uyruk yok).
   * Mevcut kayıt varsa zengin alanları EZMEZ — yalnız takım/pozisyon/isFree günceller.
   * Yoksa minimal kayıt açar; oyuncu oynayınca /players upsert'ü zenginleştirir.
   */
  private async upsertSquadPlayer(
    sp: ExternalSquadPlayer,
    teamId: string,
    positions: Map<string, string>,
    counts: Counts,
  ): Promise<void> {
    const code = positionCode(sp.position);
    const positionId = code ? positions.get(code) : undefined;
    const existing = await this.prisma.player.findUnique({
      where: { externalId: sp.externalId },
      select: { id: true },
    });
    if (existing) {
      counts.playersUpdated++;
      await this.prisma.player.update({
        where: { id: existing.id },
        data: { teamId, isFree: false, ...(positionId ? { positionId } : {}) },
      });
      return;
    }
    const { firstName, lastName } = splitName(sp.name);
    counts.playersInserted++;
    await this.prisma.player.create({
      data: {
        externalId: sp.externalId,
        firstName,
        lastName,
        firstNameTr: firstName,
        lastNameTr: lastName,
        nationality: 'Unknown', // /squads uyruk vermez; /players sonradan doldurur
        teamId,
        positionId,
        isFree: false,
        photo: sp.photo,
        photoSourceUrl: sp.photo,
      },
    });
  }

  /** Oyuncunun lig×sezon istatistiklerini upsert eder (ekstra API isteği yok). */
  private async upsertStats(
    playerId: string,
    stats: ExternalPlayerStat[],
    maps: RunMaps,
    counts: Counts,
  ): Promise<void> {
    for (const st of stats) {
      const leagueId = maps.leagueIdByExt.get(st.leagueExternalId) ?? null;
      const teamId = st.teamExternalId
        ? (maps.teamIdByExt.get(st.teamExternalId) ?? null)
        : null;
      const fields = {
        leagueId,
        teamId,
        appearances: st.appearances,
        lineups: st.lineups,
        minutes: st.minutes,
        rating: st.rating,
        captain: st.captain,
        goalsTotal: st.goalsTotal,
        goalsConceded: st.goalsConceded,
        goalsAssists: st.goalsAssists,
        goalsSaves: st.goalsSaves,
        shotsTotal: st.shotsTotal,
        shotsOn: st.shotsOn,
        passesTotal: st.passesTotal,
        passesKey: st.passesKey,
        passesAccuracy: st.passesAccuracy,
        tacklesTotal: st.tacklesTotal,
        tacklesBlocks: st.tacklesBlocks,
        tacklesInterceptions: st.tacklesInterceptions,
        duelsTotal: st.duelsTotal,
        duelsWon: st.duelsWon,
        dribblesAttempts: st.dribblesAttempts,
        dribblesSuccess: st.dribblesSuccess,
        foulsDrawn: st.foulsDrawn,
        foulsCommitted: st.foulsCommitted,
        cardsYellow: st.cardsYellow,
        cardsYellowRed: st.cardsYellowRed,
        cardsRed: st.cardsRed,
        penaltyWon: st.penaltyWon,
        penaltyCommitted: st.penaltyCommitted,
        penaltyScored: st.penaltyScored,
        penaltyMissed: st.penaltyMissed,
        penaltySaved: st.penaltySaved,
      };
      await this.prisma.playerStatistic.upsert({
        where: {
          playerId_leagueExternalId_season: {
            playerId,
            leagueExternalId: st.leagueExternalId,
            season: st.season,
          },
        },
        create: {
          playerId,
          leagueExternalId: st.leagueExternalId,
          season: st.season,
          ...fields,
        },
        update: { ...fields, updatedAt: new Date() },
      });
      counts.statsUpserted++;
    }
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

  private async persistRun(
    startedAt: Date,
    counts: Counts,
    fatalError: string | undefined,
    quotaHit: boolean,
  ): Promise<string> {
    const completedAt = new Date();
    const status = fatalError
      ? SyncRunStatus.Failed
      : counts.errorCount > 0 || quotaHit
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
      `Sync ${run.id}: leagues=${counts.leaguesProcessed} teams=${counts.teamsInserted + counts.teamsUpdated} players=${counts.playersInserted + counts.playersUpdated} stats=${counts.statsUpserted} transfers=${counts.transfersCreated}+${counts.transfersUpdated} quotaHit=${quotaHit}`,
    );
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

/** "E. Bilgin" → {firstName:'E.', lastName:'Bilgin'}. Tek kelime → ikisi de aynı. */
function splitName(full: string): { firstName: string; lastName: string } {
  const s = full.trim();
  const i = s.indexOf(' ');
  if (i === -1) {
    const v = (s || 'N/A').slice(0, 32);
    return { firstName: v, lastName: v };
  }
  return {
    firstName: s.slice(0, i).slice(0, 32),
    lastName: s.slice(i + 1).slice(0, 32),
  };
}
