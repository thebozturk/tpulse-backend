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
});
