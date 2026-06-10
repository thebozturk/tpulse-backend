import { PostWithRel } from '../../posts/post.repository';
import { FeedConfig } from '../feed.config';
import { Candidate } from '../pipeline/types';
import { TopKSelector } from './top-k.selector';

function config(maxResults: number): FeedConfig {
  return {
    affinityFavourite: 1.3,
    affinityFollow: 1.5,
    sourceLimit: 200,
    maxResults,
  } as FeedConfig;
}

function candidate(id: string, score: number, createdMs: number): Candidate {
  return {
    post: {
      id,
      hotScore: score,
      createdAtUtc: new Date(createdMs),
    } as unknown as PostWithRel,
    score,
    origins: new Set(['favourite']),
  };
}

describe('TopKSelector', () => {
  it('sorts by score descending', () => {
    const selector = new TopKSelector(config(10));
    const out = selector.select([
      candidate('a', 1, 0),
      candidate('b', 5, 0),
      candidate('c', 3, 0),
    ]);
    expect(out.map((c) => c.post.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by newer post first', () => {
    const selector = new TopKSelector(config(10));
    const out = selector.select([
      candidate('old', 2, 1000),
      candidate('new', 2, 5000),
    ]);
    expect(out.map((c) => c.post.id)).toEqual(['new', 'old']);
  });

  it('truncates to maxResults', () => {
    const selector = new TopKSelector(config(2));
    const out = selector.select([
      candidate('a', 1, 0),
      candidate('b', 2, 0),
      candidate('c', 3, 0),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.post.id)).toEqual(['c', 'b']);
  });

  it('does not mutate the input array', () => {
    const selector = new TopKSelector(config(10));
    const input = [candidate('a', 1, 0), candidate('b', 2, 0)];
    selector.select(input);
    expect(input.map((c) => c.post.id)).toEqual(['a', 'b']);
  });
});
