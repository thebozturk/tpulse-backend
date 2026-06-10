import { Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { Candidate, Scorer } from '../pipeline/types';

/**
 * Yazar çeşitliliği: aynı yazardan art arda gösterimi söndürür (X'in Author
 * Diversity Scorer'ı). Adaylar skor sırasına göre gezilir; bir yazarın n'inci
 * gösterimine çarpan uygulanır:
 *
 *   multiplier = (1 - floor)·decay^n + floor
 *
 * n=0 → 1.0 (ilk gösterim tam), sonraki gösterimler floor'a doğru azalır.
 */
@Injectable()
export class AuthorDiversityScorer implements Scorer {
  readonly name = 'author-diversity';

  constructor(private readonly config: FeedConfig) {}

  score(candidates: Candidate[]): Candidate[] {
    const { diversityDecay: decay, diversityFloor: floor } = this.config;
    const ordered = [...candidates].sort((a, b) => b.score - a.score);

    const authorCount = new Map<string, number>();
    const adjustedById = new Map<string, number>();
    for (const c of ordered) {
      const authorId = c.post.ownerId;
      const n = authorCount.get(authorId) ?? 0;
      const multiplier = (1 - floor) * Math.pow(decay, n) + floor;
      adjustedById.set(c.post.id, c.score * multiplier);
      authorCount.set(authorId, n + 1);
    }

    return candidates.map((c) => ({
      ...c,
      score: adjustedById.get(c.post.id) ?? c.score,
    }));
  }
}
