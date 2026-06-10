import { Inject, Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { FEED_REPOSITORY, IFeedRepository } from '../feed.repository';
import { Candidate, FeedQuery, Source, toCandidate } from '../pipeline/types';

/**
 * In-network (konu ilgisi): kullanıcının favori oyuncu/takım/haberci'leriyle
 * eşleşen postlar. X'in Thunder in-network kaynağının uyarlaması.
 */
@Injectable()
export class FavouriteSource implements Source {
  readonly name = 'favourite';

  constructor(
    @Inject(FEED_REPOSITORY) private readonly repo: IFeedRepository,
    private readonly config: FeedConfig,
  ) {}

  async fetch(query: FeedQuery): Promise<Candidate[]> {
    const { playerIds, teamIds, reporterUserIds } = query.favourite;
    if (!playerIds.length && !teamIds.length && !reporterUserIds.length) {
      return [];
    }
    const posts = await this.repo.byFavourite(
      query.favourite,
      this.config.sourceLimit,
    );
    return posts.map((p) => toCandidate(p, 'favourite'));
  }
}
