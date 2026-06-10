import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FOLLOW_REPOSITORY, IFollowRepository } from './follow.repository';

export type FollowOutcome = 'followed' | 'unchanged';
export type UnfollowOutcome = 'unfollowed' | 'unchanged';

@Injectable()
export class FollowsService {
  constructor(
    @Inject(FOLLOW_REPOSITORY) private readonly repo: IFollowRepository,
  ) {}

  async follow(followerId: string, targetId: string): Promise<FollowOutcome> {
    if (followerId === targetId) {
      throw new BadRequestException('Kendini takip edemezsin');
    }
    if (!(await this.repo.userExists(targetId))) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return (await this.repo.create(followerId, targetId))
      ? 'followed'
      : 'unchanged';
  }

  async unfollow(
    followerId: string,
    targetId: string,
  ): Promise<UnfollowOutcome> {
    return (await this.repo.remove(followerId, targetId))
      ? 'unfollowed'
      : 'unchanged';
  }

  getFollowingIds(userId: string): Promise<string[]> {
    return this.repo.getFollowingIds(userId);
  }
}
