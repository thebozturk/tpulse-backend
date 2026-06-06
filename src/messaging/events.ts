export const OUTBOX_QUEUE = 'outbox';

export enum OutboxEventType {
  PostCreate = 'post.create',
  PostReaction = 'post.reaction',
  CommentCreate = 'comment.create',
  CommentReaction = 'comment.reaction',
  NotificationGenerate = 'notification.generate', // Faz 6
}

export interface NotificationGenerateEvent {
  transferId: string;
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

export interface CommentCreateEvent {
  userId: string;
  postId: string;
  content?: string;
  parentId?: string;
  createdAtUtc: string;
}

export interface CommentReactionEvent {
  commentId: string;
  userId: string;
  isLike: boolean;
}

export interface OutboxJobData {
  messageId: string;
}
