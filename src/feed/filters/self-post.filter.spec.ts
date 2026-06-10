import { PostWithRel } from '../../posts/post.repository';
import { Candidate, FeedQuery } from '../pipeline/types';
import { SelfPostFilter } from './self-post.filter';

function candidate(id: string, ownerId: string): Candidate {
  return {
    post: { id, ownerId } as unknown as PostWithRel,
    score: 1,
    origins: new Set(['discovery']),
  };
}

const query: FeedQuery = {
  userId: 'me',
  page: 1,
  pageSize: 20,
  favourite: { playerIds: [], teamIds: [], reporterUserIds: [] },
  followingIds: [],
  seenIds: new Set(),
  suppressedAuthorIds: new Set(),
  mutedKeywords: [],
};

describe('SelfPostFilter', () => {
  const filter = new SelfPostFilter();

  it("removes the viewer's own posts", () => {
    const { kept, removed } = filter.apply(
      [candidate('a', 'me'), candidate('b', 'other'), candidate('c', 'me')],
      query,
    );
    expect(kept.map((c) => c.post.id)).toEqual(['b']);
    expect(removed.map((c) => c.post.id)).toEqual(['a', 'c']);
  });
});
