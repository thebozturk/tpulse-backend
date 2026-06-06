import { CommentWithOwner } from './comment.repository';
import { buildCommentTree } from './comment.mapper';

const mk = (id: string, parentId: string | null): CommentWithOwner =>
  ({
    id,
    ownerId: 'u',
    content: id,
    postId: 'p',
    parentId,
    likeCount: 0,
    createdAtUtc: new Date(0),
    owner: { username: 'bob', profilePic: null },
  }) as unknown as CommentWithOwner;

describe('buildCommentTree (2-seviye)', () => {
  it('nests replies under top-level comment', () => {
    const tree = buildCommentTree(
      [mk('c1', null), mk('c2', 'c1'), mk('c3', null)],
      new Set(['c2']),
    );
    expect(tree.map((t) => t.id)).toEqual(['c1', 'c3']);
    expect(tree[0].replies.map((r) => r.id)).toEqual(['c2']);
    expect(tree[0].replies[0].isLiked).toBe(true);
  });

  it('flattens reply-to-reply under the root', () => {
    const tree = buildCommentTree(
      [mk('c1', null), mk('c2', 'c1'), mk('c3', 'c2')],
      new Set(),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].replies.map((r) => r.id).sort()).toEqual(['c2', 'c3']);
  });
});
