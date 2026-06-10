import { PostWithRel } from '../../posts/post.repository';
import { Candidate, FeedQuery } from '../pipeline/types';
import { SeenServedFilter } from './seen-served.filter';

function candidate(id: string): Candidate {
  return {
    post: { id } as unknown as PostWithRel,
    score: 1,
    origins: new Set(['favourite']),
  };
}

function query(seen: string[]): FeedQuery {
  return {
    userId: 'u',
    page: 1,
    pageSize: 20,
    favourite: { playerIds: [], teamIds: [], reporterUserIds: [] },
    followingIds: [],
    seenIds: new Set(seen),
    suppressedAuthorIds: new Set(),
    mutedKeywords: [],
  };
}

describe('SeenServedFilter', () => {
  const filter = new SeenServedFilter();

  it('keeps everything when no seen ids', () => {
    const { kept, removed } = filter.apply(
      [candidate('a'), candidate('b')],
      query([]),
    );
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(0);
  });

  it('removes candidates already seen/served', () => {
    const { kept, removed } = filter.apply(
      [candidate('a'), candidate('b'), candidate('c')],
      query(['b']),
    );
    expect(kept.map((c) => c.post.id)).toEqual(['a', 'c']);
    expect(removed.map((c) => c.post.id)).toEqual(['b']);
  });
});
