import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { ImageUploadService } from '../storage/image-upload.service';
import { TRANSFER_REPOSITORY } from '../transfers/transfer.repository';
import { LEAGUE_REPOSITORY } from './league.repository';
import { LeaguesService } from './leagues.service';

describe('LeaguesService', () => {
  let service: LeaguesService;
  let repo: Record<string, jest.Mock>;

  const league = {
    id: 'l1',
    name: 'Premier League',
    country: 'England',
    countryLogo: 'c.png',
    leagueLogo: 'l.png',
    leagueCode: 'PL',
    _count: { teams: 20 },
  };

  beforeEach(async () => {
    repo = { getAll: jest.fn(), getById: jest.fn(), getByCode: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        LeaguesService,
        { provide: LEAGUE_REPOSITORY, useValue: repo },
        { provide: TRANSFER_REPOSITORY, useValue: {} },
        { provide: ImageUploadService, useValue: {} },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(LeaguesService);
  });

  it('findAll returns paged envelope with teamCount mapped', async () => {
    repo.getAll.mockResolvedValue({ items: [league], total: 1 });
    const res = await service.findAll(1, 20);
    expect(res).toMatchObject({
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    expect(res.items[0]).toMatchObject({
      id: 'l1',
      teamCount: 20,
      leagueCode: 'PL',
    });
  });

  it('findById throws NotFound when missing', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
  });
});
