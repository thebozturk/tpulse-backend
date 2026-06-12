import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SyncRunStatus } from '../../common/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import { passthroughCache } from '../../common/redis/cache.test-util';
import { ImageMirrorService } from '../../storage/image-mirror.service';
import {
  ExternalLeagueMeta,
  FOOTBALL_DATA_CLIENT,
  QuotaExhaustedError,
} from './football-data.client';
import { FootballDataSyncService } from './football-data.sync.service';

function leagueMeta(
  externalId: number,
  type: 'League' | 'Cup',
  currentSeason: number | null = 2025,
): ExternalLeagueMeta {
  return {
    externalId,
    name: `L${externalId}`,
    country: 'X',
    countryLogo: 'c',
    leagueLogo: 'l',
    currentSeason,
    type,
  };
}

function playerStat(leagueExternalId: number, season = 2025) {
  return {
    leagueExternalId,
    season,
    teamExternalId: 42,
    appearances: 10,
    captain: false,
    goalsTotal: 3,
    goalsAssists: 1,
  };
}

describe('FootballDataSyncService', () => {
  let service: FootballDataSyncService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let client: Record<string, jest.Mock>;
  let syncRunCreate: jest.Mock;
  let statUpsert: jest.Mock;

  function build(configOverride: Record<string, unknown> = {}) {
    syncRunCreate = jest.fn().mockResolvedValue({ id: 'run1' });
    statUpsert = jest.fn().mockResolvedValue({});
    prisma = {
      position: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pos' }),
      },
      league: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lg' }),
        update: jest.fn(),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tm' }),
        update: jest.fn(),
      },
      player: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pl' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      playerStatistic: { upsert: statUpsert },
      syncRun: { create: syncRunCreate },
    };
    const config = {
      get: jest.fn((k: string) => {
        if (k in configOverride) return configOverride[k];
        if (k === 'apiFootball.leagueIds') return [39];
        return false;
      }),
    };
    return Test.createTestingModule({
      providers: [
        FootballDataSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: FOOTBALL_DATA_CLIENT, useValue: client },
        { provide: ConfigService, useValue: config },
        { provide: ImageMirrorService, useValue: { mirror: jest.fn() } },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
  }

  beforeEach(() => {
    client = {
      getLeaguesIndex: jest.fn().mockResolvedValue([leagueMeta(39, 'League')]),
      getLeague: jest.fn(),
      getTeamsByLeague: jest
        .fn()
        .mockResolvedValue([{ externalId: 42, name: 'Arsenal' }]),
      getPlayersByTeam: jest.fn().mockResolvedValue({
        items: [
          {
            externalId: 1,
            firstName: 'B',
            lastName: 'S',
            nationality: 'England',
            position: 'Attacker',
            statistics: [playerStat(39)],
          },
        ],
        totalPages: 1,
      }),
      getSquad: jest.fn().mockResolvedValue([]),
      getTransfersByTeam: jest.fn().mockResolvedValue([]),
    };
  });

  it('lig + takım + oyuncu + stat upsert eder, Success SyncRun yazar', async () => {
    const module = await build();
    service = module.get(FootballDataSyncService);

    const { runId, remaining } = await service.syncAll();

    expect(runId).toBe('run1');
    expect(remaining).toEqual([]);
    const data = syncRunCreate.mock.calls[0][0].data;
    expect(data.status).toBe(SyncRunStatus.Success);
    expect(data.leaguesInserted).toBe(1);
    expect(data.teamsInserted).toBe(1);
    expect(data.playersInserted).toBe(1);
    expect(data.positionsCreated).toBe(4);
    // Stat unique key ile upsert edilir
    expect(statUpsert).toHaveBeenCalledTimes(1);
    const where = statUpsert.mock.calls[0][0].where;
    expect(where.playerId_leagueExternalId_season).toEqual({
      playerId: 'pl',
      leagueExternalId: 39,
      season: 2025,
    });
  });

  it('lig-tipini kupadan önce işler ve kupada kadro çekmez', async () => {
    client.getLeaguesIndex.mockResolvedValue([
      leagueMeta(2, 'Cup'),
      leagueMeta(39, 'League'),
    ]);
    const module = await build({ 'apiFootball.leagueIds': [2, 39] });
    service = module.get(FootballDataSyncService);

    await service.syncAll();

    // Takımlar her iki competition için çekilir
    const teamCalls = client.getTeamsByLeague.mock.calls.map((c) => c[0]);
    expect(teamCalls).toEqual([39, 2]); // League önce, Cup sonra
    // Kadro yalnız lig-tipi takım için (dedup: aynı takım kupada atlanır)
    expect(client.getPlayersByTeam).toHaveBeenCalledTimes(1);
  });

  it('quota tükenince kalan ligleri remaining ile döner, Partial yazar', async () => {
    client.getLeaguesIndex.mockResolvedValue([leagueMeta(39, 'League')]);
    client.getPlayersByTeam.mockRejectedValue(new QuotaExhaustedError(0));
    const module = await build({ 'apiFootball.leagueIds': [39] });
    service = module.get(FootballDataSyncService);

    const { remaining } = await service.syncAll();

    expect(remaining).toContain(39);
    const data = syncRunCreate.mock.calls[0][0].data;
    expect(data.status).toBe(SyncRunStatus.Partial);
  });

  it('fetchSquads acikken /players listesinde olmayan kadro oyuncusunu minimal ekler', async () => {
    client.getSquad.mockResolvedValue([
      { externalId: 1, name: 'B. S', position: 'Attacker' }, // /players icinde var → atlanir
      { externalId: 99, name: 'E. Bilgin', position: 'Goalkeeper' }, // yeni → eklenir
    ]);
    const module = await build({
      'apiFootball.leagueIds': [39],
      'apiFootball.fetchSquads': true,
    });
    service = module.get(FootballDataSyncService);

    await service.syncAll();

    expect(client.getSquad).toHaveBeenCalledWith(42);
    const created = prisma.player.create.mock.calls.map(
      (c) => c[0].data.externalId,
    );
    expect(created).toContain(99); // squad-only oyuncu oluşturuldu
    const squadCreate = prisma.player.create.mock.calls.find(
      (c) => c[0].data.externalId === 99,
    )[0].data;
    expect(squadCreate).toMatchObject({
      firstName: 'E.',
      lastName: 'Bilgin',
      nationality: 'Unknown',
    });
  });

  it('sezonu olmayan (kapsam yok) ligi atlar, hata sayar', async () => {
    client.getLeaguesIndex.mockResolvedValue([leagueMeta(39, 'League', null)]);
    const module = await build({ 'apiFootball.leagueIds': [39] });
    service = module.get(FootballDataSyncService);

    await service.syncAll();

    expect(client.getTeamsByLeague).not.toHaveBeenCalled();
    const data = syncRunCreate.mock.calls[0][0].data;
    expect(data.errorCount).toBe(1);
  });
});
