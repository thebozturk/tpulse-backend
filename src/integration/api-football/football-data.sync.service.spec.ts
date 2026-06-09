import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SyncRunStatus } from '../../common/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import { passthroughCache } from '../../common/redis/cache.test-util';
import { ImageMirrorService } from '../../storage/image-mirror.service';
import { FOOTBALL_DATA_CLIENT } from './football-data.client';
import { FootballDataSyncService } from './football-data.sync.service';

describe('FootballDataSyncService', () => {
  let service: FootballDataSyncService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let syncRunCreate: jest.Mock;

  beforeEach(async () => {
    syncRunCreate = jest.fn().mockResolvedValue({ id: 'run1' });
    prisma = {
      position: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pos' }),
      },
      league: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lg' }),
        update: jest.fn(),
      },
      team: {
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
      syncRun: { create: syncRunCreate },
    };
    const client = {
      getLeague: jest.fn().mockResolvedValue({
        externalId: 39,
        name: 'PL',
        country: 'England',
        countryLogo: 'c',
        leagueLogo: 'l',
      }),
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
          },
        ],
        totalPages: 1,
      }),
      getTransfersByTeam: jest.fn().mockResolvedValue([]),
    };
    const config = {
      getOrThrow: jest.fn((k: string) =>
        k === 'apiFootball.season' ? 2024 : [39],
      ),
      get: jest.fn().mockReturnValue(false),
    };

    const module = await Test.createTestingModule({
      providers: [
        FootballDataSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: FOOTBALL_DATA_CLIENT, useValue: client },
        { provide: ConfigService, useValue: config },
        { provide: ImageMirrorService, useValue: { mirror: jest.fn() } },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(FootballDataSyncService);
  });

  it('syncAll upserts and writes a Success SyncRun', async () => {
    const runId = await service.syncAll();
    expect(runId).toBe('run1');
    const data = syncRunCreate.mock.calls[0][0].data;
    expect(data.status).toBe(SyncRunStatus.Success);
    expect(data.leaguesInserted).toBe(1);
    expect(data.teamsInserted).toBe(1);
    expect(data.playersInserted).toBe(1);
    expect(data.positionsCreated).toBe(4);
  });
});
