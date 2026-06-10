import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FOLLOW_REPOSITORY, IFollowRepository } from './follow.repository';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;
  let repo: jest.Mocked<IFollowRepository>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      remove: jest.fn(),
      exists: jest.fn(),
      getFollowingIds: jest.fn(),
      userExists: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: FOLLOW_REPOSITORY, useValue: repo },
      ],
    }).compile();

    service = module.get(FollowsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('follow', () => {
    it('should follow when target exists and not yet followed', async () => {
      repo.userExists.mockResolvedValue(true);
      repo.create.mockResolvedValue(true);

      await expect(service.follow('a', 'b')).resolves.toBe('followed');
      expect(repo.create).toHaveBeenCalledWith('a', 'b');
    });

    it('should return unchanged when already following', async () => {
      repo.userExists.mockResolvedValue(true);
      repo.create.mockResolvedValue(false);

      await expect(service.follow('a', 'b')).resolves.toBe('unchanged');
    });

    it('should throw BadRequest when following self', async () => {
      await expect(service.follow('a', 'a')).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.userExists).not.toHaveBeenCalled();
    });

    it('should throw NotFound when target user does not exist', async () => {
      repo.userExists.mockResolvedValue(false);

      await expect(service.follow('a', 'b')).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('should unfollow when a follow existed', async () => {
      repo.remove.mockResolvedValue(true);
      await expect(service.unfollow('a', 'b')).resolves.toBe('unfollowed');
    });

    it('should return unchanged when no follow existed', async () => {
      repo.remove.mockResolvedValue(false);
      await expect(service.unfollow('a', 'b')).resolves.toBe('unchanged');
    });
  });

  it('getFollowingIds delegates to repository', async () => {
    repo.getFollowingIds.mockResolvedValue(['b', 'c']);
    await expect(service.getFollowingIds('a')).resolves.toEqual(['b', 'c']);
  });
});
