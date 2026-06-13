import { Test } from '@nestjs/testing';
import { ImageUploadService } from '../storage/image-upload.service';
import { NewsSortQueryDto } from './dto/news-query.dto';
import { NEWS_REPOSITORY } from './news.repository';
import { NewsService } from './news.service';

describe('NewsService', () => {
  let service: NewsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      getByPlayerId: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      distinctSources: jest.fn().mockResolvedValue(['Fabrizio', 'AMK']),
    };
    const module = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NEWS_REPOSITORY, useValue: repo },
        { provide: ImageUploadService, useValue: {} },
      ],
    }).compile();
    service = module.get(NewsService);
  });

  it('findByPlayer sortBy/order paramlarını repository.getByPlayerId içine geçirir', async () => {
    const query: NewsSortQueryDto = {
      page: 1,
      pageSize: 5,
      sortBy: 'publishDate',
      order: 'desc',
    };

    const result = await service.findByPlayer('player-1', query, 'tr');

    expect(repo.getByPlayerId).toHaveBeenCalledWith(
      'player-1',
      1,
      5,
      'publishDate',
      'desc',
    );
    expect(result).toMatchObject({ page: 1, pageSize: 5, totalCount: 0 });
  });

  it('findAll search ve sourceName filtrelerini repository.getAll içine geçirir', async () => {
    await service.findAll(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'publishDate',
        order: 'desc',
        search: 'osimhen',
        sourceName: 'Fabrizio',
      } as never,
      'tr',
    );
    expect(repo.getAll).toHaveBeenCalledWith(
      1,
      20,
      'publishDate',
      'desc',
      'osimhen',
      'Fabrizio',
    );
  });

  it('listSources kaynak çip listesini döner', async () => {
    await expect(service.listSources()).resolves.toEqual(['Fabrizio', 'AMK']);
  });
});
