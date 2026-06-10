import { Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { Candidate, Scorer } from '../pipeline/types';

/**
 * Out-of-network söndürme: yalnızca keşiften gelen (favourite/follow ile
 * çakışmayan) adayların skoru oonAttenuation (≤1) ile çarpılır. In-network
 * içerik aynı popülerlikte keşfe tercih edilir.
 */
@Injectable()
export class OonScorer implements Scorer {
  readonly name = 'oon';

  constructor(private readonly config: FeedConfig) {}

  score(candidates: Candidate[]): Candidate[] {
    return candidates.map((c) => {
      const pureOon =
        c.origins.has('discovery') &&
        !c.origins.has('favourite') &&
        !c.origins.has('follow');
      return pureOon
        ? { ...c, score: c.score * this.config.oonAttenuation }
        : c;
    });
  }
}
