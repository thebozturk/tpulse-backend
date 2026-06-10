import { Inject, Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { FEED_REPOSITORY, IFeedRepository } from '../feed.repository';
import { Candidate, FeedQuery, Source, toCandidate } from '../pipeline/types';

/**
 * Out-of-network keşif: favourite/follow dışından, global olarak yüksek
 * hotScore (trend/popüler) alan postlar. Filter balonunu kırar; X'in Phoenix
 * retrieval kaynağının ML'siz (popülerlik tabanlı) uyarlaması.
 *
 * Aday in-network kaynaklarla çakışırsa runner birleştirir; salt-keşif
 * kalanlar OonScorer'da hafifçe söndürülür.
 */
@Injectable()
export class DiscoverySource implements Source {
  readonly name = 'discovery';

  constructor(
    @Inject(FEED_REPOSITORY) private readonly repo: IFeedRepository,
    private readonly config: FeedConfig,
  ) {}

  async fetch(query: FeedQuery): Promise<Candidate[]> {
    const posts = await this.repo.discovery(
      query.userId,
      this.config.sourceLimit,
    );
    return posts.map((p) => toCandidate(p, 'discovery'));
  }
}
