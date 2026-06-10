import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeHotScore,
  DEFAULT_HOT_SCORE_WEIGHTS,
  HotScoreWeights,
} from './hot-score';

/**
 * Post.hotScore denormalize alanını günceller. Engagement (like/vote/comment)
 * işlendikten sonra çağrılır — son sayaçları okur, skoru hesaplar, yazar.
 * Fail-open: hata feed yazma yolunu (like/vote/comment) bozmaz, yalnızca warn'lanır.
 */
@Injectable()
export class HotScoreService {
  private readonly logger = new Logger(HotScoreService.name);
  private readonly weights: HotScoreWeights;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.weights =
      config.get<HotScoreWeights>('feed.weights') ?? DEFAULT_HOT_SCORE_WEIGHTS;
  }

  async recompute(postId: string): Promise<void> {
    try {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          likeCount: true,
          agreeCount: true,
          disagreeCount: true,
          commentCount: true,
          createdAtUtc: true,
        },
      });
      if (!post) {
        return;
      }
      const hotScore = computeHotScore(post, this.weights);
      await this.prisma.post.update({
        where: { id: postId },
        data: { hotScore, scoreUpdatedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(
        `hotScore recompute hatası (post=${postId}): ${String(err)}`,
      );
    }
  }
}
