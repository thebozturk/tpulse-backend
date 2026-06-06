import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import { CreatePostDto, UpdatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PostFilterDto, PostVoteResultDto } from './dto/post-query.dto';
import { assertPostShape } from './post-shape';
import { toPostResponse } from './post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostWithRel,
} from './post.repository';
import { agreePercentage, disagreePercentage, totalVotes } from './vote-math';

export type LikeOutcome = 'queued' | 'unchanged';

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly repo: IPostRepository,
    private readonly outbox: OutboxService,
  ) {}

  async feed(
    filter: PostFilterDto,
    user?: AuthUser,
  ): Promise<PagedResult<PostResponseDto>> {
    if (filter.onlyFavourites) {
      if (!user) {
        throw new UnauthorizedException('Favori feed için giriş gerekli');
      }
      // Faz 6: FavouriteService entegrasyonu — şimdilik boş feed.
      return buildPaged([], 0, filter.page, filter.pageSize);
    }
    const { items, total } = await this.repo.feed(filter);
    const mapped = await this.hydrate(items, user);
    return buildPaged(mapped, total, filter.page, filter.pageSize);
  }

  async findById(id: string, user?: AuthUser): Promise<PostResponseDto> {
    const post = await this.repo.getById(id);
    if (!post) {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    return (await this.hydrate([post], user))[0];
  }

  async byPlayer(
    playerId: string,
    user?: AuthUser,
  ): Promise<PostResponseDto[]> {
    return this.hydrate(await this.repo.getByPlayer(playerId), user);
  }

  async byTeam(teamId: string, user?: AuthUser): Promise<PostResponseDto[]> {
    return this.hydrate(await this.repo.getByTeam(teamId), user);
  }

  async my(userId: string): Promise<PostResponseDto[]> {
    const items = await this.repo.getByOwner(userId);
    return this.hydrate(items, { userId } as AuthUser);
  }

  newCount(afterPostId: string): Promise<number> {
    return this.repo.newCountAfter(afterPostId);
  }

  async createAsync(dto: CreatePostDto, userId: string): Promise<void> {
    assertPostShape(dto);
    await this.outbox.enqueue(OutboxEventType.PostCreate, {
      userId,
      content: dto.content,
      postType: dto.postType,
      isVotingEnabled: dto.isVotingEnabled,
      playerId: dto.playerId,
      teamId: dto.teamId,
      fromTeamId: dto.fromTeamId,
      toTeamId: dto.toTeamId,
      createdAtUtc: new Date().toISOString(),
    });
  }

  async vote(
    postId: string,
    userId: string,
    choice: number,
  ): Promise<PostVoteResultDto> {
    const outcome = await this.repo.vote(postId, userId, choice);
    if (outcome.status === 'NotFound') {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    if (outcome.status === 'Disabled') {
      throw new BadRequestException('Bu gönderide oylama kapalı');
    }
    return {
      result: outcome.status === 'Applied' ? 'Applied' : 'Unchanged',
      agreeCount: outcome.agreeCount,
      disagreeCount: outcome.disagreeCount,
      totalVotes: totalVotes(outcome.agreeCount, outcome.disagreeCount),
      agreePercentage: agreePercentage(
        outcome.agreeCount,
        outcome.disagreeCount,
      ),
      disagreePercentage: disagreePercentage(
        outcome.agreeCount,
        outcome.disagreeCount,
      ),
      userVote: outcome.userVote,
    };
  }

  async update(id: string, userId: string, dto: UpdatePostDto): Promise<void> {
    const meta = await this.repo.getOwnerAndType(id);
    if (!meta) {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    if (meta.ownerId !== userId) {
      throw new ForbiddenException('Bu gönderi sana ait değil');
    }
    assertPostShape({ postType: meta.postType, ...dto });
    await this.repo.update(id, dto);
  }

  async remove(id: string, userId: string): Promise<void> {
    const meta = await this.repo.getOwnerAndType(id);
    if (!meta) {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    if (meta.ownerId !== userId) {
      throw new ForbiddenException('Bu gönderi sana ait değil');
    }
    await this.repo.delete(id);
  }

  async react(
    postId: string,
    userId: string,
    isLike: boolean,
  ): Promise<LikeOutcome> {
    if (!(await this.repo.exists(postId))) {
      throw new NotFoundException('Gönderi bulunamadı');
    }
    const current = await this.repo.isLiked(postId, userId);
    if (current === isLike) {
      return 'unchanged';
    }
    await this.outbox.enqueue(OutboxEventType.PostReaction, {
      postId,
      userId,
      isLike,
    });
    return 'queued';
  }

  private async hydrate(
    posts: PostWithRel[],
    user?: AuthUser,
  ): Promise<PostResponseDto[]> {
    if (!user) {
      return posts.map((p) => toPostResponse(p, false, undefined));
    }
    const ids = posts.map((p) => p.id);
    const [liked, votes] = await Promise.all([
      this.repo.getLikedPostIds(user.userId, ids),
      this.repo.getUserVotes(user.userId, ids),
    ]);
    return posts.map((p) =>
      toPostResponse(p, liked.has(p.id), votes.get(p.id)),
    );
  }
}
