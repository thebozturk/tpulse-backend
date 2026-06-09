import { Test } from '@nestjs/testing';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { SEARCH_REPOSITORY } from './search.repository';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      searchPlayers: jest.fn().mockResolvedValue([
        {
          id: 'p1',
          firstName: 'Bukayo',
          lastName: 'Saka',
          photo: null,
          nationality: 'England',
        },
      ]),
      searchTeams: jest
        .fn()
        .mockResolvedValue([{ id: 't1', name: 'Arsenal', logo: 'a.png' }]),
      searchLeagues: jest
        .fn()
        .mockResolvedValue([
          { id: 'l1', name: 'PL', leagueLogo: 'l.png', country: 'England' },
        ]),
      searchPlayersPaged: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: SEARCH_REPOSITORY, useValue: repo },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(SearchService);
  });

  it('groups results by type with mapped fields', async () => {
    const res = await service.search({ q: 'a', limit: 5 });
    expect(res.query).toBe('a');
    expect(res.data.players[0]).toMatchObject({
      type: 'player',
      name: 'Bukayo Saka',
      subtitle: 'England',
    });
    expect(res.data.teams[0]).toMatchObject({ type: 'team', name: 'Arsenal' });
    expect(res.data.leagues[0]).toMatchObject({
      type: 'league',
      subtitle: 'England',
    });
  });

  it('forwards query/page/pageSize to paged player search', async () => {
    await service.searchPlayersPaged({ query: 'sak', page: 2, pageSize: 30 });
    expect(repo.searchPlayersPaged).toHaveBeenCalledWith('sak', 2, 30);
  });
});
