import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { HotScoreService } from '../common/scoring/hot-score.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CommentCreateEvent,
  CommentReactionEvent,
  NotificationGenerateEvent,
  OUTBOX_QUEUE,
  OutboxEventType,
  OutboxJobData,
  PostCreateEvent,
  PostReactionEvent,
} from './events';

/**
 * Outbox işleyici (docs/04). Idempotent (Redis lock job:outbox:{id}). Hata → retryCount++ + throw
 * (BullMQ attempts:5 retry). Başarı → processedAtUtc.
 */
@Processor(OUTBOX_QUEUE)
export class ReactionProcessor extends WorkerHost {
  private readonly logger = new Logger(ReactionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly hotScore: HotScoreService,
  ) {
    super();
  }

  async process(job: Job<OutboxJobData>): Promise<void> {
    const { messageId } = job.data;
    const msg = await this.prisma.outboxMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || msg.processedAtUtc) {
      return;
    }

    const lock = await this.redis.client.set(
      `job:outbox:${messageId}`,
      '1',
      'EX',
      600,
      'NX',
    );
    if (lock !== 'OK') {
      return; // başka worker işliyor
    }

    try {
      const payload = JSON.parse(msg.payload);
      switch (msg.eventType) {
        case OutboxEventType.PostCreate:
          await this.handlePostCreate(payload as PostCreateEvent);
          break;
        case OutboxEventType.PostReaction:
          await this.handlePostReaction(payload as PostReactionEvent);
          break;
        case OutboxEventType.CommentCreate:
          await this.handleCommentCreate(payload as CommentCreateEvent);
          break;
        case OutboxEventType.CommentReaction:
          await this.handleCommentReaction(payload as CommentReactionEvent);
          break;
        case OutboxEventType.NotificationGenerate:
          await this.notifications.generateForTransfer(
            (payload as NotificationGenerateEvent).transferId,
          );
          break;
        default:
          this.logger.warn(`Bilinmeyen event: ${msg.eventType}`);
      }
      await this.prisma.outboxMessage.update({
        where: { id: messageId },
        data: { processedAtUtc: new Date() },
      });
    } catch (err) {
      await this.prisma.outboxMessage.update({
        where: { id: messageId },
        data: {
          retryCount: { increment: 1 },
          lastError: err instanceof Error ? err.message : 'unknown',
        },
      });
      throw err;
    }
  }

  private async handlePostCreate(e: PostCreateEvent): Promise<void> {
    await this.prisma.post.create({
      data: {
        ownerId: e.userId,
        content: e.content,
        postType: e.postType,
        isVotingEnabled: e.isVotingEnabled,
        playerId: e.playerId,
        teamId: e.teamId,
        fromTeamId: e.fromTeamId,
        toTeamId: e.toTeamId,
        createdAtUtc: new Date(e.createdAtUtc),
      },
    });
  }

  private async handlePostReaction(e: PostReactionEvent): Promise<void> {
    if (e.isLike) {
      try {
        await this.prisma.postLike.create({
          data: { postId: e.postId, userId: e.userId },
        });
        await this.prisma.post.update({
          where: { id: e.postId },
          data: { likeCount: { increment: 1 } },
        });
      } catch (err) {
        // P2002 (zaten beğenmiş) → idempotent no-op
        if (!isUniqueViolation(err)) {
          throw err;
        }
      }
    } else {
      const { count } = await this.prisma.postLike.deleteMany({
        where: { postId: e.postId, userId: e.userId },
      });
      if (count > 0) {
        await this.prisma.post.update({
          where: { id: e.postId },
          data: { likeCount: { decrement: 1 } },
        });
      }
    }
    await this.hotScore.recompute(e.postId);
  }

  private async handleCommentCreate(e: CommentCreateEvent): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: e.postId },
      select: { id: true },
    });
    if (!post) {
      return; // parent post yok → no-op (job başarılı sayılır)
    }
    await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          ownerId: e.userId,
          postId: e.postId,
          content: e.content,
          parentId: e.parentId,
          createdAtUtc: new Date(e.createdAtUtc),
        },
      }),
      this.prisma.post.update({
        where: { id: e.postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);
    await this.hotScore.recompute(e.postId);
  }

  private async handleCommentReaction(e: CommentReactionEvent): Promise<void> {
    if (e.isLike) {
      try {
        await this.prisma.commentLike.create({
          data: { commentId: e.commentId, userId: e.userId },
        });
        await this.prisma.comment.update({
          where: { id: e.commentId },
          data: { likeCount: { increment: 1 } },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err;
        }
      }
    } else {
      const { count } = await this.prisma.commentLike.deleteMany({
        where: { commentId: e.commentId, userId: e.userId },
      });
      if (count > 0) {
        await this.prisma.comment.update({
          where: { id: e.commentId },
          data: { likeCount: { decrement: 1 } },
        });
      }
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}
