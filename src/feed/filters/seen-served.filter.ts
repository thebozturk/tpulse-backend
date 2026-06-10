import { Injectable } from '@nestjs/common';
import { Candidate, FeedQuery, Filter } from '../pipeline/types';

/**
 * Daha önce sunulan (Redis served) veya client'ın "gördüm" bildirdiği post'ları
 * eler. X'in PreviouslyServed/SeenPostsFilter'larının birleşik uyarlaması.
 */
@Injectable()
export class SeenServedFilter implements Filter {
  readonly name = 'seen-served';

  apply(
    candidates: Candidate[],
    query: FeedQuery,
  ): { kept: Candidate[]; removed: Candidate[] } {
    if (query.seenIds.size === 0) {
      return { kept: candidates, removed: [] };
    }
    const kept: Candidate[] = [];
    const removed: Candidate[] = [];
    for (const c of candidates) {
      if (query.seenIds.has(c.post.id)) {
        removed.push(c);
      } else {
        kept.push(c);
      }
    }
    return { kept, removed };
  }
}
