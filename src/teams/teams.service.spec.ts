import { Test } from '@nestjs/testing';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { ImageUploadService } from '../storage/image-upload.service';
import { TRANSFER_REPOSITORY } from '../transfers/transfer.repository';
import { TeamFilterDto } from './dto/team-filter.dto';
import { TEAM_REPOSITORY } from './team.repository';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = { getAll: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: TEAM_REPOSITORY, useValue: repo },
        { provide: TRANSFER_REPOSITORY, useValue: {} },
        { provide: ImageUploadService, useValue: {} },
        { provide: CacheService, useValue: passthroughCache() },
      ],
    }).compile();
    service = module.get(TeamsService);
  });

  it('findAll lig + arama filtresini repository.getAll içine server-side geçirir', async () => {
    repo.getAll.mockResolvedValue({ items: [], total: 0 });
    const filter: TeamFilterDto = {
      page: 1,
      pageSize: 20,
      leagueId: 'league-1',
      search: 'galata',
    };

    const result = await service.findAll(filter, 'tr');

    expect(repo.getAll).toHaveBeenCalledWith(filter);
    expect(result).toMatchObject({ page: 1, pageSize: 20, totalCount: 0 });
  });
});
