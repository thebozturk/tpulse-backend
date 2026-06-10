import { CommentWithOwner } from './comment.repository';
import { CommentDto } from './dto/comment.dto';

function toDto(c: CommentWithOwner, isLiked: boolean): CommentDto {
  return {
    id: c.id,
    ownerId: c.ownerId,
    ownerName: c.owner.username,
    ownerPhoto: c.owner.profilePic ?? undefined,
    verificationType: c.owner.verificationType,
    content: c.content ?? undefined,
    postId: c.postId,
    parentId: c.parentId ?? undefined,
    likeCount: c.likeCount,
    isLiked,
    createdAtUtc: c.createdAtUtc,
    replies: [],
  };
}

/**
 * 2-seviye ağaç: top-level (parentId=null) + direkt/dolaylı reply'lar root altında düzleşir.
 */
export function buildCommentTree(
  comments: CommentWithOwner[],
  liked: Set<string>,
): CommentDto[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const dtos = new Map(comments.map((c) => [c.id, toDto(c, liked.has(c.id))]));
  const tops: CommentDto[] = [];

  const rootId = (c: CommentWithOwner): string => {
    let cur = c;
    while (cur.parentId && byId.has(cur.parentId)) {
      cur = byId.get(cur.parentId)!;
    }
    return cur.id;
  };

  for (const c of comments) {
    const dto = dtos.get(c.id)!;
    const root = rootId(c);
    if (root === c.id) {
      tops.push(dto);
    } else {
      dtos.get(root)?.replies.push(dto);
    }
  }
  return tops;
}
