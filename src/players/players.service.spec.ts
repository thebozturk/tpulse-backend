import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { NewsService } from '../news/news.service';
import { PostsService } from '../posts/posts.service';
import { ImageUploadService } from '../storage/image-upload.service';
import { TRANSFER_REPOSITORY } from '../transfers/transfer.repository';
import { PLAYER_REPOSITORY } from './player.repository';
import { PlayersService } from './players.service';

describe('PlayersService', () => {
  let service: PlayersService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      getAll: jest.fn(),
      getById: jest.fn(),
      getByTeamId: jest.fn(),
      getByNationality: jest.fn(),
      getFreeAgents: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: PLAYER_REPOSITORY, useValue: repo },
        { provide: TRANSFER_REPOSITORY, useValue: {} },
        { provide: ImageUploadService, useValue: {} },
        { provide: NewsService, useValue: {} },
        { provide: PostsService, useValue: {} },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(PlayersService);
  });

  it('findAll forwards the filter to the repository', async () => {
    repo.getAll.mockResolvedValue({ items: [], total: 0 });
    const filter = { teamId: 't1', page: 2, pageSize: 10 };
    await service.findAll(filter as never, 'tr');
    expect(repo.getAll).toHaveBeenCalledWith(filter);
  });

  it('findAll lig filtresini de repository.getAll içine geçirir', async () => {
    repo.getAll.mockResolvedValue({ items: [], total: 0 });
    const filter = { leagueId: 'l1', search: 'osimhen', page: 1, pageSize: 20 };
    await service.findAll(filter as never, 'tr');
    expect(repo.getAll).toHaveBeenCalledWith(filter);
  });

  it('findAll filtresiz istekte boş sayfa döner, repo hiç çağrılmaz', async () => {
    const result = await service.findAll(
      { page: 1, pageSize: 20 } as never,
      'tr',
    );
    expect(repo.getAll).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [], totalCount: 0 });
  });

  it('findById throws NotFound when missing', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x', 'tr')).rejects.toThrow(
      NotFoundException,
    );
  });
});
