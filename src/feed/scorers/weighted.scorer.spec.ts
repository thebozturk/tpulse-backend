import { PostWithRel } from '../../posts/post.repository';
import { Candidate } from '../pipeline/types';
import { WeightedScorer } from './weighted.scorer';

function candidate(hotScore: number): Candidate {
  return {
    post: { id: 'p', hotScore } as unknown as PostWithRel,
    score: 0,
    origins: new Set(['favourite']),
  };
}

describe('WeightedScorer', () => {
  const scorer = new WeightedScorer();

  it('sets base score from post.hotScore', () => {
    const out = scorer.score([candidate(4.2)]);
    expect(out[0].score).toBe(4.2);
  });

  it('preserves order count and origins', () => {
    const out = scorer.score([candidate(1), candidate(2)]);
    expect(out).toHaveLength(2);
    expect(out[1].origins.has('favourite')).toBe(true);
  });
});
