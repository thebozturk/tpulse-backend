import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import { buildCommentTree } from './comment.mapper';
import {
  COMMENT_REPOSITORY,
  CommentAdminFilter,
  ICommentRepository,
} from './comment.repository';
import { AdminCommentItemDto } from './dto/admin-comment-item.dto';
import { CommentDto, CreateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly repo: ICommentRepository,
    private readonly outbox: OutboxService,
  ) {}

  async getByPost(postId: string, user?: AuthUser): Promise<CommentDto[]> {
    const comments = await this.repo.getByPostId(postId);
    const liked = user
      ? await this.repo.getLikedCommentIds(
          user.userId,
          comments.map((c) => c.id),
        )
      : new Set<string>();
    return buildCommentTree(comments, liked);
  }

  async createAsync(
    postId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<void> {
    if (!(await this.repo.postExists(postId))) {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    await this.outbox.enqueue(OutboxEventType.CommentCreate, {
      userId,
      postId,
      content: dto.content,
      parentId: dto.parentId,
      createdAtUtc: new Date().toISOString(),
    });
  }

  async update(id: string, userId: string, content: string): Promise<void> {
    await this.assertOwner(id, userId);
    await this.repo.update(id, content);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOwner(id, userId);
    await this.repo.delete(id);
  }

  /** BO-3: admin owner kontrolü olmadan siler (cascade ile yanıt/beğeni temizlenir). */
  async adminRemove(id: string): Promise<void> {
    const owner = await this.repo.getOwner(id);
    if (owner === null) {
      throw new NotFoundException('Yorum bulunamadı');
    }
    await this.repo.delete(id);
  }

  /** BO-3: moderasyon listesi (ownerId/q filtreli, sayfalı, düz liste). */
  async adminList(
    filter: CommentAdminFilter,
  ): Promise<PagedResult<AdminCommentItemDto>> {
    const { items, total } = await this.repo.adminList(filter);
    const mapped: AdminCommentItemDto[] = items.map((c) => ({
      id: c.id,
      postId: c.postId,
      ownerId: c.ownerId,
      ownerUsername: c.owner.username,
      content: c.content ?? '',
      likeCount: c.likeCount,
      createdAt: c.createdAtUtc,
    }));
    return buildPaged(mapped, total, filter.page, filter.pageSize);
  }

  async reactAsync(
    commentId: string,
    userId: string,
    isLike: boolean,
  ): Promise<void> {
    if (!(await this.repo.exists(commentId))) {
      throw new NotFoundException('Yorum bulunamadı');
    }
    await this.outbox.enqueue(OutboxEventType.CommentReaction, {
      commentId,
      userId,
      isLike,
    });
  }

  private async assertOwner(id: string, userId: string): Promise<void> {
    const owner = await this.repo.getOwner(id);
    if (owner === null) {
      throw new NotFoundException('Yorum bulunamadı');
    }
    if (owner !== userId) {
      throw new ForbiddenException('Bu yorum sana ait değil');
    }
  }
}
