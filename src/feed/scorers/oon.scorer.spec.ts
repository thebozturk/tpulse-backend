import { PostWithRel } from '../../posts/post.repository';
import { FeedConfig } from '../feed.config';
import { Candidate, CandidateOrigin } from '../pipeline/types';
import { OonScorer } from './oon.scorer';

const config = { oonAttenuation: 0.8 } as FeedConfig;

function candidate(score: number, origins: CandidateOrigin[]): Candidate {
  return {
    post: { id: 'p' } as unknown as PostWithRel,
    score,
    origins: new Set(origins),
  };
}

describe('OonScorer', () => {
  const scorer = new OonScorer(config);

  it('attenuates pure out-of-network candidates', () => {
    const out = scorer.score([candidate(10, ['discovery'])]);
    expect(out[0].score).toBeCloseTo(8, 6);
  });

  it('does not attenuate in-network candidates', () => {
    expect(scorer.score([candidate(10, ['follow'])])[0].score).toBe(10);
    expect(scorer.score([candidate(10, ['favourite'])])[0].score).toBe(10);
  });

  it('does not attenuate when discovery overlaps in-network', () => {
    const out = scorer.score([candidate(10, ['discovery', 'follow'])]);
    expect(out[0].score).toBe(10);
  });
});
