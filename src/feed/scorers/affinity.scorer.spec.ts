import { PostWithRel } from '../../posts/post.repository';
import { FeedConfig } from '../feed.config';
import { Candidate, CandidateOrigin } from '../pipeline/types';
import { AffinityScorer } from './affinity.scorer';

const config = {
  affinityFavourite: 1.3,
  affinityFollow: 1.5,
  sourceLimit: 200,
  maxResults: 200,
} as FeedConfig;

function candidate(score: number, origins: CandidateOrigin[]): Candidate {
  return {
    post: { id: 'p', hotScore: score } as unknown as PostWithRel,
    score,
    origins: new Set(origins),
  };
}

describe('AffinityScorer', () => {
  const scorer = new AffinityScorer(config);

  it('applies favourite multiplier for favourite-origin candidates', () => {
    const out = scorer.score([candidate(10, ['favourite'])]);
    expect(out[0].score).toBeCloseTo(13, 6);
  });

  it('applies the stronger follow multiplier', () => {
    const out = scorer.score([candidate(10, ['follow'])]);
    expect(out[0].score).toBeCloseTo(15, 6);
  });

  it('prefers follow bonus when candidate has both origins', () => {
    const out = scorer.score([candidate(10, ['favourite', 'follow'])]);
    expect(out[0].score).toBeCloseTo(15, 6);
  });

  it('leaves score unchanged when no in-network origin', () => {
    const out = scorer.score([candidate(10, ['discovery'])]);
    expect(out[0].score).toBe(10);
  });
});
