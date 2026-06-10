import { Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { Candidate, Selector } from '../pipeline/types';

/**
 * Skora göre azalan sırala, havuzu maxResults'a kırp. Tie-break: daha yeni post
 * (createdAtUtc) önce. Sayfalama bu sıralı havuz üzerinden FeedService'te yapılır.
 */
@Injectable()
export class TopKSelector implements Selector {
  constructor(private readonly config: FeedConfig) {}

  select(candidates: Candidate[]): Candidate[] {
    return [...candidates]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.post.createdAtUtc.getTime() - a.post.createdAtUtc.getTime();
      })
      .slice(0, this.config.maxResults);
  }
}
