import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  let service: TransfersService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = { query: jest.fn(), getById: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: TRANSFER_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(TransfersService);
  });

  it('query asks repository for non-rumour transfers (isRumour=false)', async () => {
    repo.query.mockResolvedValue({ items: [], total: 0 });
    const filter = { page: 1, pageSize: 20 };
    await service.query(filter as never);
    expect(repo.query).toHaveBeenCalledWith(filter, false);
  });

  it('findById throws NotFound and excludes rumours', async () => {
    repo.getById.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    expect(repo.getById).toHaveBeenCalledWith('x', false);
  });
});
