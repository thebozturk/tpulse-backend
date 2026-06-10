import { Injectable } from '@nestjs/common';
import { Candidate, FeedQuery, Filter } from '../pipeline/types';

/**
 * Engellenen veya susturulan yazarların postlarını eler (negatif sinyal).
 * X'in AuthorSocialgraphFilter'ının uyarlaması.
 */
@Injectable()
export class BlockedAuthorFilter implements Filter {
  readonly name = 'blocked-author';

  apply(
    candidates: Candidate[],
    query: FeedQuery,
  ): { kept: Candidate[]; removed: Candidate[] } {
    if (query.suppressedAuthorIds.size === 0) {
      return { kept: candidates, removed: [] };
    }
    const kept: Candidate[] = [];
    const removed: Candidate[] = [];
    for (const c of candidates) {
      if (query.suppressedAuthorIds.has(c.post.ownerId)) {
        removed.push(c);
      } else {
        kept.push(c);
      }
    }
    return { kept, removed };
  }
}
