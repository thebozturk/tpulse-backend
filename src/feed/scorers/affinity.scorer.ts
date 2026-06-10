import { Injectable } from '@nestjs/common';
import { FeedConfig } from '../feed.config';
import { Candidate, Scorer } from '../pipeline/types';

/**
 * In-network yakınlık bonusu: takip edilen yazar (kişi ilgisi) favori konudan
 * daha güçlü sinyaldir. Aday birden çok kökenden geldiyse en güçlü bonus uygulanır.
 */
@Injectable()
export class AffinityScorer implements Scorer {
  readonly name = 'affinity';

  constructor(private readonly config: FeedConfig) {}

  score(candidates: Candidate[]): Candidate[] {
    return candidates.map((c) => {
      let multiplier = 1;
      if (c.origins.has('follow')) {
        multiplier = this.config.affinityFollow;
      } else if (c.origins.has('favourite')) {
        multiplier = this.config.affinityFavourite;
      }
      return { ...c, score: c.score * multiplier };
    });
  }
}
