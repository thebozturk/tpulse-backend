import { Injectable } from '@nestjs/common';
import { Candidate, FeedQuery, Filter } from '../pipeline/types';

/**
 * Kullanıcının kendi postlarını feed'den eler (X'in SelfpostFilter'ı). Discovery
 * kaynağı kişiselleştirilmediği için kendi postlar burada filtrelenir.
 */
@Injectable()
export class SelfPostFilter implements Filter {
  readonly name = 'self-post';

  apply(
    candidates: Candidate[],
    query: FeedQuery,
  ): { kept: Candidate[]; removed: Candidate[] } {
    const kept: Candidate[] = [];
    const removed: Candidate[] = [];
    for (const c of candidates) {
      if (c.post.ownerId === query.userId) {
        removed.push(c);
      } else {
        kept.push(c);
      }
    }
    return { kept, removed };
  }
}
