import { Inject, Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { FEED_REPOSITORY, IFeedRepository } from '../feed.repository';
import { Candidate, FeedQuery, Source, toCandidate } from '../pipeline/types';

/**
 * In-network (kişi ilgisi): kullanıcının takip ettiği yazarların postları.
 */
@Injectable()
export class FollowSource implements Source {
  readonly name = 'follow';

  constructor(
    @Inject(FEED_REPOSITORY) private readonly repo: IFeedRepository,
    private readonly config: FeedConfig,
  ) {}

  async fetch(query: FeedQuery): Promise<Candidate[]> {
    if (query.followingIds.length === 0) {
      return [];
    }
    const posts = await this.repo.byAuthors(
      query.followingIds,
      this.config.sourceLimit,
    );
    return posts.map((p) => toCandidate(p, 'follow'));
  }
}
