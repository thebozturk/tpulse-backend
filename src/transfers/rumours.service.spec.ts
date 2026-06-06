import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { RumoursService } from './rumours.service';

describe('RumoursService', () => {
  let service: RumoursService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      query: jest.fn(),
      getById: jest.fn(),
      getByPlayerIdRumour: jest.fn().mockResolvedValue([]),
    };
    const module = await Test.createTestingModule({
      providers: [
        RumoursService,
        { provide: TRANSFER_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(RumoursService);
  });

  it('query asks repository for rumours (isRumour=true)', async () => {
    repo.query.mockResolvedValue({ items: [], total: 0 });
    await service.query({ page: 1, pageSize: 20 } as never);
    expect(repo.query).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, true);
  });

  it('findById throws NotFound and queries with isRumour=true', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    expect(repo.getById).toHaveBeenCalledWith('x', true);
  });
});
