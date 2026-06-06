import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateTransferCommentDto,
  TransferCommentDto,
} from './dto/transfer-comment.dto';
import { buildTransferCommentTree } from './transfer-comment.mapper';
import {
  ITransferCommentRepository,
  TRANSFER_COMMENT_REPOSITORY,
} from './transfer-comment.repository';

@Injectable()
export class TransferCommentsService {
  constructor(
    @Inject(TRANSFER_COMMENT_REPOSITORY)
    private readonly repo: ITransferCommentRepository,
  ) {}

  async getByTransfer(
    transferId: string,
    user?: AuthUser,
  ): Promise<TransferCommentDto[]> {
    const comments = await this.repo.getByTransferId(transferId);
    const liked = user
      ? await this.repo.getLikedCommentIds(
          user.userId,
          comments.map((c) => c.id),
        )
      : new Set<string>();
    return buildTransferCommentTree(comments, liked);
  }

  async create(
    transferId: string,
    userId: string,
    dto: CreateTransferCommentDto,
  ): Promise<{ id: string }> {
    if (!(await this.repo.transferExists(transferId))) {
      throw new NotFoundException('Transfer bulunamadı');
    }
    return this.repo.create(transferId, userId, dto.content, dto.parentId);
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

  async react(
    commentId: string,
    userId: string,
    isLike: boolean,
  ): Promise<void> {
    if (!(await this.repo.exists(commentId))) {
      throw new NotFoundException('Yorum bulunamadı');
    }
    if (isLike) {
      await this.repo.like(commentId, userId);
    } else {
      await this.repo.unlike(commentId, userId);
    }
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
