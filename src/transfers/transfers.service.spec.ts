import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  let service: TransfersService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      query: jest.fn(),
      getById: jest.fn(),
      getByYear: jest.fn(),
      getByMonth: jest.fn(),
      getBetweenTeams: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: TRANSFER_REPOSITORY, useValue: repo },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(TransfersService);
  });

  it('query asks repository for non-rumour transfers (isRumour=false)', async () => {
    repo.query.mockResolvedValue({ items: [], total: 0 });
    const filter = { page: 1, pageSize: 20 };
    await service.query(filter as never, 'tr');
    expect(repo.query).toHaveBeenCalledWith(filter, false);
  });

  it('findById throws NotFound and excludes rumours', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x', 'tr')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.getById).toHaveBeenCalledWith('x', false);
  });

  it('byYear forwards pagination + sort and returns PagedResult envelope', async () => {
    repo.getByYear.mockResolvedValue({ items: [], total: 0 });
    const result = await service.byYear(
      2025,
      { page: 2, pageSize: 10, sort: '-feeAmount' } as never,
      'tr',
    );
    expect(repo.getByYear).toHaveBeenCalledWith(2025, 2, 10, '-feeAmount');
    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it('betweenTeams forwards pagination to repository', async () => {
    repo.getBetweenTeams.mockResolvedValue({ items: [], total: 0 });
    await service.betweenTeams(
      {
        fromTeamId: 'a',
        toTeamId: 'b',
        includeReverse: true,
        page: 1,
        pageSize: 20,
      } as never,
      'tr',
    );
    expect(repo.getBetweenTeams).toHaveBeenCalledWith('a', 'b', true, 1, 20);
  });
});
