import { Injectable } from '@nestjs/common';
import { Candidate, FeedQuery, Filter } from '../pipeline/types';

/**
 * İçeriğinde kullanıcının susturduğu kelimelerden biri geçen postları eler
 * (case-insensitive substring). X'in MutedKeywordFilter'ının uyarlaması.
 */
@Injectable()
export class MutedKeywordFilter implements Filter {
  readonly name = 'muted-keyword';

  apply(
    candidates: Candidate[],
    query: FeedQuery,
  ): { kept: Candidate[]; removed: Candidate[] } {
    if (query.mutedKeywords.length === 0) {
      return { kept: candidates, removed: [] };
    }
    const kept: Candidate[] = [];
    const removed: Candidate[] = [];
    for (const c of candidates) {
      const content = c.post.content.toLowerCase();
      if (query.mutedKeywords.some((kw) => content.includes(kw))) {
        removed.push(c);
      } else {
        kept.push(c);
      }
    }
    return { kept, removed };
  }
}
