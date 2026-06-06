import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OutboxService } from '../messaging/outbox.service';
import { COMMENT_REPOSITORY } from './comment.repository';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: Record<string, jest.Mock>;
  let outbox: { enqueue: jest.Mock };

  beforeEach(async () => {
    repo = {
      postExists: jest.fn(),
      exists: jest.fn(),
      getOwner: jest.fn(),
      update: jest.fn(),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: COMMENT_REPOSITORY, useValue: repo },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();
    service = module.get(CommentsService);
  });

  it('createAsync throws 404 when post missing', async () => {
    repo.postExists.mockResolvedValue(false);
    await expect(
      service.createAsync('post', 'u', { content: 'hi' }),
    ).rejects.toThrow(NotFoundException);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('createAsync enqueues comment.create when post exists', async () => {
    repo.postExists.mockResolvedValue(true);
    await service.createAsync('post', 'u', { content: 'hi' });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'comment.create',
      expect.objectContaining({ postId: 'post', userId: 'u' }),
    );
  });

  it('reactAsync throws 404 when comment missing', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.reactAsync('c', 'u', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update throws 403 when not owner', async () => {
    repo.getOwner.mockResolvedValue('other');
    await expect(service.update('c', 'u', 'x')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
