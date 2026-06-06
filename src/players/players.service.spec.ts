import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
      ],
    }).compile();
    service = module.get(PlayersService);
  });

  it('findAll forwards the filter to the repository', async () => {
    repo.getAll.mockResolvedValue({ items: [], total: 0 });
    const filter = { teamId: 't1', page: 2, pageSize: 10 };
    await service.findAll(filter as never);
    expect(repo.getAll).toHaveBeenCalledWith(filter);
  });

  it('findById throws NotFound when missing', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
  });
});
