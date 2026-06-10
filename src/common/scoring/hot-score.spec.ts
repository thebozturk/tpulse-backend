import {
  computeHotScore,
  DEFAULT_HOT_SCORE_WEIGHTS,
  HotScoreInput,
} from './hot-score';

describe('computeHotScore', () => {
  const now = new Date('2026-06-10T12:00:00.000Z');

  const base = (overrides: Partial<HotScoreInput> = {}): HotScoreInput => ({
    likeCount: 0,
    agreeCount: 0,
    disagreeCount: 0,
    commentCount: 0,
    createdAtUtc: now,
    ...overrides,
  });

  it('returns 0 when there is no engagement', () => {
    expect(computeHotScore(base(), DEFAULT_HOT_SCORE_WEIGHTS, now)).toBe(0);
  });

  it('weights comments higher than likes for equal counts', () => {
    const likeOnly = computeHotScore(
      base({ likeCount: 10 }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    const commentOnly = computeHotScore(
      base({ commentCount: 10 }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    expect(commentOnly).toBeGreaterThan(likeOnly);
  });

  it('sums agree and disagree into the vote signal', () => {
    const score = computeHotScore(
      base({ agreeCount: 4, disagreeCount: 6 }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    // weighted = 0.5 * (4 + 6) = 5 ; age = 0 -> /(0+2)^1.5
    expect(score).toBeCloseTo(5 / Math.pow(2, 1.5), 6);
  });

  it('decays score as the post ages (same engagement)', () => {
    const fresh = computeHotScore(
      base({ likeCount: 100, createdAtUtc: now }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    const dayOld = computeHotScore(
      base({
        likeCount: 100,
        createdAtUtc: new Date(now.getTime() - 24 * 3_600_000),
      }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    expect(dayOld).toBeLessThan(fresh);
  });

  it('higher gravity decays old content faster', () => {
    const old = base({
      likeCount: 100,
      createdAtUtc: new Date(now.getTime() - 48 * 3_600_000),
    });
    const lowGravity = computeHotScore(
      old,
      { ...DEFAULT_HOT_SCORE_WEIGHTS, gravity: 1 },
      now,
    );
    const highGravity = computeHotScore(
      old,
      { ...DEFAULT_HOT_SCORE_WEIGHTS, gravity: 2 },
      now,
    );
    expect(highGravity).toBeLessThan(lowGravity);
  });

  it('never divides by zero for future-dated posts', () => {
    const score = computeHotScore(
      base({
        likeCount: 10,
        createdAtUtc: new Date(now.getTime() + 60 * 3_600_000),
      }),
      DEFAULT_HOT_SCORE_WEIGHTS,
      now,
    );
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeCloseTo(10 / Math.pow(2, 1.5), 6);
  });
});
