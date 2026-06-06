import { TransferCommentWithOwner } from './transfer-comment.repository';
import { TransferCommentDto } from './dto/transfer-comment.dto';

function toDto(
  c: TransferCommentWithOwner,
  isLiked: boolean,
): TransferCommentDto {
  return {
    id: c.id,
    ownerId: c.ownerId,
    ownerName: c.owner.username,
    ownerPhoto: c.owner.profilePic ?? undefined,
    content: c.content ?? undefined,
    transferId: c.transferId,
    parentId: c.parentId ?? undefined,
    likeCount: c.likeCount,
    isLiked,
    createdAtUtc: c.createdAtUtc,
    replies: [],
  };
}

/** 2-seviye ağaç (yorum ile aynı mantık). */
export function buildTransferCommentTree(
  comments: TransferCommentWithOwner[],
  liked: Set<string>,
): TransferCommentDto[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const dtos = new Map(comments.map((c) => [c.id, toDto(c, liked.has(c.id))]));
  const tops: TransferCommentDto[] = [];

  const rootId = (c: TransferCommentWithOwner): string => {
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
