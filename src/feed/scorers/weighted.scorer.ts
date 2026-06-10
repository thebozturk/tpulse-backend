import { Injectable } from '@nestjs/common';
import { Candidate, Scorer } from '../pipeline/types';

/**
 * Taban skor = post.hotScore. Multi-action ağırlıklandırma (like/vote/comment +
 * zaman sönümü) zaten yazma yolunda hotScore'a gömülüdür (bkz. HotScoreService).
 * Bu scorer adayın taban skorunu hotScore'dan başlatır; sonraki scorer'lar
 * (affinity, diversity) bunu çarpan olarak işler.
 */
@Injectable()
export class WeightedScorer implements Scorer {
  readonly name = 'weighted';

  score(candidates: Candidate[]): Candidate[] {
    return candidates.map((c) => ({ ...c, score: c.post.hotScore }));
  }
}
