import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TRANSFER_COMMENT_REPOSITORY } from './transfer-comment.repository';
import { TransferCommentsService } from './transfer-comments.service';

describe('TransferCommentsService', () => {
  let service: TransferCommentsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      transferExists: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'tc1' }),
      exists: jest.fn(),
      like: jest.fn(),
      unlike: jest.fn(),
      getOwner: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        TransferCommentsService,
        { provide: TRANSFER_COMMENT_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(TransferCommentsService);
  });

  it('create throws 404 when transfer missing (or deleted)', async () => {
    repo.transferExists.mockResolvedValue(false);
    await expect(service.create('t', 'u', { content: 'hi' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('create returns id synchronously when transfer exists', async () => {
    repo.transferExists.mockResolvedValue(true);
    expect(await service.create('t', 'u', { content: 'hi' })).toEqual({
      id: 'tc1',
    });
  });

  it('react likes synchronously when comment exists', async () => {
    repo.exists.mockResolvedValue(true);
    await service.react('tc1', 'u', true);
    expect(repo.like).toHaveBeenCalledWith('tc1', 'u');
  });

  it('update throws 403 when not owner', async () => {
    repo.getOwner.mockResolvedValue('other');
    await expect(service.update('tc1', 'u', 'x')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
