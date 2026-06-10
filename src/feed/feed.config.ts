import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_HOT_SCORE_WEIGHTS,
  HotScoreWeights,
} from '../common/scoring/hot-score';

/** configuration() içindeki `feed` namespace'inin tipi. */
export interface FeedRawConfig {
  weights: HotScoreWeights;
  affinity: { favourite: number; follow: number };
  sourceLimit: number;
  maxResults: number;
}

export const DEFAULT_FEED_CONFIG: FeedRawConfig = {
  weights: DEFAULT_HOT_SCORE_WEIGHTS,
  affinity: { favourite: 1.3, follow: 1.5 },
  sourceLimit: 200,
  maxResults: 200,
};

/**
 * Feed skor parametrelerine tipli erişim. Tüm ağırlık/limit'ler env'den gelir
 * (magic number yok); env yoksa DEFAULT_FEED_CONFIG kullanılır.
 */
@Injectable()
export class FeedConfig {
  readonly affinityFavourite: number;
  readonly affinityFollow: number;
  readonly sourceLimit: number;
  readonly maxResults: number;

  constructor(config: ConfigService) {
    const f = config.get<FeedRawConfig>('feed') ?? DEFAULT_FEED_CONFIG;
    this.affinityFavourite =
      f.affinity?.favourite ?? DEFAULT_FEED_CONFIG.affinity.favourite;
    this.affinityFollow =
      f.affinity?.follow ?? DEFAULT_FEED_CONFIG.affinity.follow;
    this.sourceLimit = f.sourceLimit ?? DEFAULT_FEED_CONFIG.sourceLimit;
    this.maxResults = f.maxResults ?? DEFAULT_FEED_CONFIG.maxResults;
  }
}
