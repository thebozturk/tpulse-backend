import { PostWithRel } from '../../posts/post.repository';
import { FeedConfig } from '../feed.config';
import { Candidate } from '../pipeline/types';
import { AuthorDiversityScorer } from './author-diversity.scorer';

const config = { diversityDecay: 0.5, diversityFloor: 0.1 } as FeedConfig;

function candidate(id: string, ownerId: string, score: number): Candidate {
  return {
    post: { id, ownerId } as unknown as PostWithRel,
    score,
    origins: new Set(['favourite']),
  };
}

function byId(out: Candidate[]): Record<string, number> {
  return Object.fromEntries(out.map((c) => [c.post.id, c.score]));
}

describe('AuthorDiversityScorer', () => {
  const scorer = new AuthorDiversityScorer(config);

  it('leaves a single post per author unchanged', () => {
    const out = byId(
      scorer.score([candidate('a', 'u1', 10), candidate('b', 'u2', 8)]),
    );
    expect(out.a).toBeCloseTo(10, 6);
    expect(out.b).toBeCloseTo(8, 6);
  });

  it('decays the second post from the same author', () => {
    const out = byId(
      scorer.score([
        candidate('first', 'u1', 10),
        candidate('second', 'u1', 10),
      ]),
    );
    // n=0 -> *1.0 ; n=1 -> *(0.9*0.5 + 0.1)=0.55
    expect(out.first).toBeCloseTo(10, 6);
    expect(out.second).toBeCloseTo(5.5, 6);
  });

  it('applies decay in score order, not input order', () => {
    // lower-scored same-author post is the one penalised
    const out = byId(
      scorer.score([candidate('low', 'u1', 4), candidate('high', 'u1', 10)]),
    );
    expect(out.high).toBeCloseTo(10, 6); // first in score order
    expect(out.low).toBeCloseTo(2.2, 6); // 4 * 0.55
  });

  it('does not mutate the input array', () => {
    const input = [candidate('a', 'u1', 10), candidate('b', 'u1', 10)];
    scorer.score(input);
    expect(input.map((c) => c.score)).toEqual([10, 10]);
  });
});
