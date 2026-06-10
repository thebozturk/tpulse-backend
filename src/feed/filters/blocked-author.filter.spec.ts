import { PostWithRel } from '../../posts/post.repository';
import { Candidate, FeedQuery } from '../pipeline/types';
import { BlockedAuthorFilter } from './blocked-author.filter';

function candidate(id: string, ownerId: string): Candidate {
  return {
    post: { id, ownerId } as unknown as PostWithRel,
    score: 1,
    origins: new Set(['discovery']),
  };
}

function query(suppressed: string[]): FeedQuery {
  return {
    userId: 'u',
    page: 1,
    pageSize: 20,
    favourite: { playerIds: [], teamIds: [], reporterUserIds: [] },
    followingIds: [],
    seenIds: new Set(),
    suppressedAuthorIds: new Set(suppressed),
    mutedKeywords: [],
  };
}

describe('BlockedAuthorFilter', () => {
  const filter = new BlockedAuthorFilter();

  it('keeps all when nothing suppressed', () => {
    const { kept } = filter.apply(
      [candidate('a', 'u1'), candidate('b', 'u2')],
      query([]),
    );
    expect(kept).toHaveLength(2);
  });

  it('removes posts from blocked/muted authors', () => {
    const { kept, removed } = filter.apply(
      [candidate('a', 'u1'), candidate('b', 'u2'), candidate('c', 'u1')],
      query(['u1']),
    );
    expect(kept.map((c) => c.post.id)).toEqual(['b']);
    expect(removed.map((c) => c.post.id)).toEqual(['a', 'c']);
  });
});
