import { PostWithRel } from '../../posts/post.repository';
import { PipelineRunner } from './pipeline.runner';
import {
  Candidate,
  FeedQuery,
  Filter,
  Scorer,
  Selector,
  Source,
  toCandidate,
} from './types';

function post(id: string, hotScore = 1): PostWithRel {
  return {
    id,
    hotScore,
    createdAtUtc: new Date(0),
  } as unknown as PostWithRel;
}

const query: FeedQuery = {
  userId: 'u',
  page: 1,
  pageSize: 20,
  favourite: { playerIds: [], teamIds: [], reporterUserIds: [] },
  followingIds: [],
};

const passthroughSelector: Selector = { select: (c) => c };

describe('PipelineRunner', () => {
  const runner = new PipelineRunner();

  it('merges candidates from parallel sources', async () => {
    const s1: Source = {
      name: 's1',
      fetch: async () => [toCandidate(post('a'), 'favourite')],
    };
    const s2: Source = {
      name: 's2',
      fetch: async () => [toCandidate(post('b'), 'follow')],
    };

    const out = await runner.run(query, {
      sources: [s1, s2],
      filters: [],
      scorers: [],
      selector: passthroughSelector,
    });

    expect(out.map((c) => c.post.id).sort()).toEqual(['a', 'b']);
  });

  it('dedups the same post and unions its origins', async () => {
    const s1: Source = {
      name: 's1',
      fetch: async () => [toCandidate(post('a'), 'favourite')],
    };
    const s2: Source = {
      name: 's2',
      fetch: async () => [toCandidate(post('a'), 'follow')],
    };

    const out = await runner.run(query, {
      sources: [s1, s2],
      filters: [],
      scorers: [],
      selector: passthroughSelector,
    });

    expect(out).toHaveLength(1);
    expect([...out[0].origins].sort()).toEqual(['favourite', 'follow']);
  });

  it('degrades gracefully when a source throws', async () => {
    const ok: Source = {
      name: 'ok',
      fetch: async () => [toCandidate(post('a'), 'favourite')],
    };
    const broken: Source = {
      name: 'broken',
      fetch: async () => {
        throw new Error('boom');
      },
    };

    const out = await runner.run(query, {
      sources: [ok, broken],
      filters: [],
      scorers: [],
      selector: passthroughSelector,
    });

    expect(out.map((c) => c.post.id)).toEqual(['a']);
  });

  it('runs filters then scorers in order', async () => {
    const src: Source = {
      name: 'src',
      fetch: async () => [
        toCandidate(post('keep'), 'favourite'),
        toCandidate(post('drop'), 'favourite'),
      ],
    };
    const dropFilter: Filter = {
      name: 'drop',
      apply: (candidates: Candidate[]) => ({
        kept: candidates.filter((c) => c.post.id !== 'drop'),
        removed: candidates.filter((c) => c.post.id === 'drop'),
      }),
    };
    const bumpScorer: Scorer = {
      name: 'bump',
      score: (candidates: Candidate[]) =>
        candidates.map((c) => ({ ...c, score: 42 })),
    };

    const out = await runner.run(query, {
      sources: [src],
      filters: [dropFilter],
      scorers: [bumpScorer],
      selector: passthroughSelector,
    });

    expect(out).toHaveLength(1);
    expect(out[0].post.id).toBe('keep');
    expect(out[0].score).toBe(42);
  });
});
