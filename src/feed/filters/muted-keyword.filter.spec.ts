import { PostWithRel } from '../../posts/post.repository';
import { Candidate, FeedQuery } from '../pipeline/types';
import { MutedKeywordFilter } from './muted-keyword.filter';

function candidate(id: string, content: string): Candidate {
  return {
    post: { id, content } as unknown as PostWithRel,
    score: 1,
    origins: new Set(['discovery']),
  };
}

function query(keywords: string[]): FeedQuery {
  return {
    userId: 'u',
    page: 1,
    pageSize: 20,
    favourite: { playerIds: [], teamIds: [], reporterUserIds: [] },
    followingIds: [],
    seenIds: new Set(),
    suppressedAuthorIds: new Set(),
    mutedKeywords: keywords,
  };
}

describe('MutedKeywordFilter', () => {
  const filter = new MutedKeywordFilter();

  it('keeps all when no muted keywords', () => {
    const { kept } = filter.apply([candidate('a', 'Merhaba dünya')], query([]));
    expect(kept).toHaveLength(1);
  });

  it('removes posts containing a muted keyword (case-insensitive)', () => {
    const { kept, removed } = filter.apply(
      [
        candidate('a', 'Bu SPONSORLU bir gönderi'),
        candidate('b', 'Temiz içerik'),
      ],
      query(['sponsorlu']),
    );
    expect(kept.map((c) => c.post.id)).toEqual(['b']);
    expect(removed.map((c) => c.post.id)).toEqual(['a']);
  });
});
