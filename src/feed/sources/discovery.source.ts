import { Inject, Injectable } from '@nestjs/common';
import { PostWithRel } from '../../posts/post.repository';
import { FeedConfig } from '../feed.config';
import { FEED_REPOSITORY, IFeedRepository } from '../feed.repository';
import { Candidate, Source, toCandidate } from '../pipeline/types';

/**
 * Out-of-network keşif: global olarak yüksek hotScore (trend/popüler) alan
 * postlar. X'in Phoenix retrieval kaynağının ML'siz (popülerlik tabanlı)
 * uyarlaması. Filter balonunu kırar.
 *
 * Sonuç kişiselleştirilmemiştir → tüm kullanıcılar için ortak; pahalı global
 * sorguyu kısa süreli in-memory cache'ler (tek process; bkz. multiInstance=false).
 * Viewer'ın kendi postu SelfPostFilter'da, engellenenler BlockedAuthorFilter'da
 * elenir.
 */
@Injectable()
export class DiscoverySource implements Source {
  readonly name = 'discovery';

  private cache: { posts: PostWithRel[]; expiresAt: number } | null = null;

  constructor(
    @Inject(FEED_REPOSITORY) private readonly repo: IFeedRepository,
    private readonly config: FeedConfig,
  ) {}

  async fetch(): Promise<Candidate[]> {
    const posts = await this.getDiscoveryPosts();
    return posts.map((p) => toCandidate(p, 'discovery'));
  }

  private async getDiscoveryPosts(): Promise<PostWithRel[]> {
    const ttlSeconds = this.config.discoveryCacheSeconds;
    const now = Date.now();
    if (ttlSeconds > 0 && this.cache && this.cache.expiresAt > now) {
      return this.cache.posts;
    }
    const posts = await this.repo.discovery(this.config.sourceLimit);
    if (ttlSeconds > 0) {
      this.cache = { posts, expiresAt: now + ttlSeconds * 1000 };
    }
    return posts;
  }
}
