import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { FavouritesService } from '../favourites/favourites.service';
import { FollowsService } from '../follows/follows.service';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { PostsService } from '../posts/posts.service';
import { PipelineRunner } from './pipeline/pipeline.runner';
import { FeedQuery } from './pipeline/types';
import { AffinityScorer } from './scorers/affinity.scorer';
import { WeightedScorer } from './scorers/weighted.scorer';
import { TopKSelector } from './selectors/top-k.selector';
import { FavouriteSource } from './sources/favourite.source';
import { FollowSource } from './sources/follow.source';

/**
 * "Senin İçin" ranked feed. X candidate-pipeline desenini orkestre eder:
 * query hydration (favourite + follow) → pipeline → sayfalama → response.
 *
 * Hiç in-network sinyali yoksa (cold start) sonuç boş döner; faz 2'de
 * DiscoverySource fallback eklenecek.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly runner: PipelineRunner,
    private readonly favouriteSource: FavouriteSource,
    private readonly followSource: FollowSource,
    private readonly weightedScorer: WeightedScorer,
    private readonly affinityScorer: AffinityScorer,
    private readonly topKSelector: TopKSelector,
    private readonly favourites: FavouritesService,
    private readonly follows: FollowsService,
    private readonly posts: PostsService,
  ) {}

  async forYou(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<PostResponseDto>> {
    const [favourite, followingIds] = await Promise.all([
      this.favourites.getTargets(userId),
      this.follows.getFollowingIds(userId),
    ]);

    const query: FeedQuery = {
      userId,
      page,
      pageSize,
      favourite,
      followingIds,
    };

    const ranked = await this.runner.run(query, {
      sources: [this.favouriteSource, this.followSource],
      filters: [],
      scorers: [this.weightedScorer, this.affinityScorer],
      selector: this.topKSelector,
    });

    const total = ranked.length;
    const { skip, take } = toSkipTake(page, pageSize);
    const pagePosts = ranked.slice(skip, skip + take).map((c) => c.post);
    const mapped = await this.posts.mapWithUserState(pagePosts, {
      userId,
    } as AuthUser);

    return buildPaged(mapped, total, page, pageSize);
  }
}
