/**
 * Post "hotScore" — zaman sönümlü ağırlıklı engagement skoru (HN/Reddit tarzı).
 * X (Twitter) algoritmasının weighted-scoring desenine uyarlanmıştır: tek bir
 * relevance yerine birden çok sinyalin (like/vote/comment) ağırlıklı toplamı,
 * gönderinin yaşına göre söndürülür. Saf fonksiyon — yan etki yok, test edilebilir.
 *
 * Not (faz 1): negatif sinyal (report) henüz dahil değil; reports modülüyle
 * birleşme faz 3'e bırakıldı.
 */

export interface HotScoreInput {
  likeCount: number;
  agreeCount: number;
  disagreeCount: number;
  commentCount: number;
  createdAtUtc: Date;
}

export interface HotScoreWeights {
  /** Beğeni ağırlığı. */
  like: number;
  /** Oy (agree + disagree) ağırlığı. */
  vote: number;
  /** Yorum ağırlığı (en güçlü sinyal). */
  comment: number;
  /** Yaş sönümü üssü — büyüdükçe eski içerik daha hızlı düşer. */
  gravity: number;
}

export const DEFAULT_HOT_SCORE_WEIGHTS: HotScoreWeights = {
  like: 1,
  vote: 0.5,
  comment: 2,
  gravity: 1.5,
};

const MILLIS_PER_HOUR = 3_600_000;

/**
 * weighted = w_like·like + w_vote·(agree+disagree) + w_comment·comment
 * hotScore = weighted / (ageHours + 2)^gravity
 */
export function computeHotScore(
  input: HotScoreInput,
  weights: HotScoreWeights = DEFAULT_HOT_SCORE_WEIGHTS,
  now: Date = new Date(),
): number {
  const weighted =
    weights.like * input.likeCount +
    weights.vote * (input.agreeCount + input.disagreeCount) +
    weights.comment * input.commentCount;

  const ageHours = Math.max(
    0,
    (now.getTime() - input.createdAtUtc.getTime()) / MILLIS_PER_HOUR,
  );

  return weighted / Math.pow(ageHours + 2, weights.gravity);
}
