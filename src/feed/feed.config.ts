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
  oonAttenuation: number;
  diversity: { decay: number; floor: number };
  servedTtlSeconds: number;
}

export const DEFAULT_FEED_CONFIG: FeedRawConfig = {
  weights: DEFAULT_HOT_SCORE_WEIGHTS,
  affinity: { favourite: 1.3, follow: 1.5 },
  sourceLimit: 200,
  maxResults: 200,
  oonAttenuation: 0.8,
  diversity: { decay: 0.5, floor: 0.1 },
  servedTtlSeconds: 86400,
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
  readonly oonAttenuation: number;
  readonly diversityDecay: number;
  readonly diversityFloor: number;
  readonly servedTtlSeconds: number;

  constructor(config: ConfigService) {
    const f = config.get<FeedRawConfig>('feed') ?? DEFAULT_FEED_CONFIG;
    this.affinityFavourite =
      f.affinity?.favourite ?? DEFAULT_FEED_CONFIG.affinity.favourite;
    this.affinityFollow =
      f.affinity?.follow ?? DEFAULT_FEED_CONFIG.affinity.follow;
    this.sourceLimit = f.sourceLimit ?? DEFAULT_FEED_CONFIG.sourceLimit;
    this.maxResults = f.maxResults ?? DEFAULT_FEED_CONFIG.maxResults;
    this.oonAttenuation =
      f.oonAttenuation ?? DEFAULT_FEED_CONFIG.oonAttenuation;
    this.diversityDecay =
      f.diversity?.decay ?? DEFAULT_FEED_CONFIG.diversity.decay;
    this.diversityFloor =
      f.diversity?.floor ?? DEFAULT_FEED_CONFIG.diversity.floor;
    this.servedTtlSeconds =
      f.servedTtlSeconds ?? DEFAULT_FEED_CONFIG.servedTtlSeconds;
  }
}
