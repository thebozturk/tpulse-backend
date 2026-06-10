/**
 * Post "hotScore" — zaman sönümlü ağırlıklı engagement skoru (HN/Reddit tarzı).
 * X (Twitter) algoritmasının weighted-scoring desenine uyarlanmıştır: tek bir
 * relevance yerine birden çok sinyalin (like/vote/comment) ağırlıklı toplamı,
 * gönderinin yaşına göre söndürülür. Saf fonksiyon — yan etki yok, test edilebilir.
 *
 * Negatif sinyal (report) ağırlıklı olarak skoru düşürür (faz 3).
 */

export interface HotScoreInput {
  likeCount: number;
  agreeCount: number;
  disagreeCount: number;
  commentCount: number;
  /** Bu posta dair açık rapor (spam/abuse) sayısı — negatif sinyal. */
  reportCount: number;
  createdAtUtc: Date;
}

export interface HotScoreWeights {
  /** Beğeni ağırlığı. */
  like: number;
  /** Oy (agree + disagree) ağırlığı. */
  vote: number;
  /** Yorum ağırlığı (en güçlü sinyal). */
  comment: number;
  /** Rapor ağırlığı (negatif — skordan düşülür). */
  report: number;
  /** Yaş sönümü üssü — büyüdükçe eski içerik daha hızlı düşer. */
  gravity: number;
}

export const DEFAULT_HOT_SCORE_WEIGHTS: HotScoreWeights = {
  like: 1,
  vote: 0.5,
  comment: 2,
  report: 5,
  gravity: 1.5,
};

const MILLIS_PER_HOUR = 3_600_000;

/**
 * weighted = w_like·like + w_vote·(agree+disagree) + w_comment·comment
 *            − w_report·report
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
    weights.comment * input.commentCount -
    weights.report * input.reportCount;

  const ageHours = Math.max(
    0,
    (now.getTime() - input.createdAtUtc.getTime()) / MILLIS_PER_HOUR,
  );

  return weighted / Math.pow(ageHours + 2, weights.gravity);
}
