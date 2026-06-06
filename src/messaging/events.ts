export const OUTBOX_QUEUE = 'outbox';

export enum OutboxEventType {
  PostCreate = 'post.create',
  PostReaction = 'post.reaction',
  CommentCreate = 'comment.create', // Faz 5b
  CommentReaction = 'comment.reaction', // Faz 5b
}

export interface PostCreateEvent {
  userId: string;
  content: string;
  postType: number;
  isVotingEnabled: boolean;
  playerId?: string;
  teamId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  createdAtUtc: string;
}

export interface PostReactionEvent {
  postId: string;
  userId: string;
  isLike: boolean;
}

export interface OutboxJobData {
  messageId: string;
}
