import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostType, PostVoteChoice } from '../common/enums';
import { FavouritesService } from '../favourites/favourites.service';
import { OutboxService } from '../messaging/outbox.service';
import { POST_REPOSITORY } from './post.repository';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let repo: Record<string, jest.Mock>;
  let outbox: { enqueue: jest.Mock };

  beforeEach(async () => {
    repo = {
      vote: jest.fn(),
      exists: jest.fn(),
      isLiked: jest.fn(),
      getOwnerAndType: jest.fn(),
      update: jest.fn(),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: POST_REPOSITORY, useValue: repo },
        { provide: OutboxService, useValue: outbox },
        { provide: FavouritesService, useValue: { getTargets: jest.fn() } },
      ],
    }).compile();
    service = module.get(PostsService);
  });

  it('createAsync enqueues post.create after shape validation', async () => {
    await service.createAsync(
      {
        content: 'hi',
        postType: PostType.Player,
        playerId: 'p',
        isVotingEnabled: false,
      },
      'u1',
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'post.create',
      expect.objectContaining({ userId: 'u1', postType: PostType.Player }),
    );
  });

  it('react returns unchanged when already in target state (no enqueue)', async () => {
    repo.exists.mockResolvedValue(true);
    repo.isLiked.mockResolvedValue(true);
    expect(await service.react('post', 'u1', true)).toBe('unchanged');
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('react enqueues reaction when state changes', async () => {
    repo.exists.mockResolvedValue(true);
    repo.isLiked.mockResolvedValue(false);
    expect(await service.react('post', 'u1', true)).toBe('queued');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'post.reaction',
      expect.objectContaining({ postId: 'post', isLike: true }),
    );
  });

  it('vote throws 404/400 for NotFound/Disabled', async () => {
    repo.vote.mockResolvedValueOnce({
      status: 'NotFound',
      agreeCount: 0,
      disagreeCount: 0,
    });
    await expect(service.vote('p', 'u', PostVoteChoice.Agree)).rejects.toThrow(
      NotFoundException,
    );
    repo.vote.mockResolvedValueOnce({
      status: 'Disabled',
      agreeCount: 0,
      disagreeCount: 0,
    });
    await expect(service.vote('p', 'u', PostVoteChoice.Agree)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('update throws 403 when not owner', async () => {
    repo.getOwnerAndType.mockResolvedValue({
      ownerId: 'other',
      postType: PostType.Player,
    });
    await expect(
      service.update('p', 'u1', { content: 'x', playerId: 'pl' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
