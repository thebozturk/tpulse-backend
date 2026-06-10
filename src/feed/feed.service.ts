import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { BlocksService } from '../blocks/blocks.service';
import { FavouritesService } from '../favourites/favourites.service';
import { FollowsService } from '../follows/follows.service';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { PostsService } from '../posts/posts.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedServedStore } from './feed-served.store';
import { BlockedAuthorFilter } from './filters/blocked-author.filter';
import { MutedKeywordFilter } from './filters/muted-keyword.filter';
import { SeenServedFilter } from './filters/seen-served.filter';
import { SelfPostFilter } from './filters/self-post.filter';
import { PipelineRunner } from './pipeline/pipeline.runner';
import { FeedQuery } from './pipeline/types';
import { AffinityScorer } from './scorers/affinity.scorer';
import { AuthorDiversityScorer } from './scorers/author-diversity.scorer';
import { OonScorer } from './scorers/oon.scorer';
import { WeightedScorer } from './scorers/weighted.scorer';
import { TopKSelector } from './selectors/top-k.selector';
import { DiscoverySource } from './sources/discovery.source';
import { FavouriteSource } from './sources/favourite.source';
import { FollowSource } from './sources/follow.source';

/**
 * "Senin İçin" ranked feed. X candidate-pipeline desenini orkestre eder:
 *   query hydration (favourite + follow + served) →
 *   sources (favourite + follow in-network, discovery out-of-network) →
 *   filters (seen/served dedup) →
 *   scorers (weighted → affinity → oon → diversity) →
 *   selector → sayfalama → response → served side-effect
 *
 * Hiç in-network sinyali yoksa (cold start) discovery devreye girer.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly runner: PipelineRunner,
    private readonly favouriteSource: FavouriteSource,
    private readonly followSource: FollowSource,
    private readonly discoverySource: DiscoverySource,
    private readonly weightedScorer: WeightedScorer,
    private readonly affinityScorer: AffinityScorer,
    private readonly oonScorer: OonScorer,
    private readonly authorDiversityScorer: AuthorDiversityScorer,
    private readonly selfPostFilter: SelfPostFilter,
    private readonly blockedAuthorFilter: BlockedAuthorFilter,
    private readonly mutedKeywordFilter: MutedKeywordFilter,
    private readonly seenServedFilter: SeenServedFilter,
    private readonly topKSelector: TopKSelector,
    private readonly served: FeedServedStore,
    private readonly favourites: FavouritesService,
    private readonly follows: FollowsService,
    private readonly blocks: BlocksService,
    private readonly posts: PostsService,
  ) {}

  async forYou(
    userId: string,
    dto: FeedQueryDto,
  ): Promise<PagedResult<PostResponseDto>> {
    const { page, pageSize } = dto;

    const [favourite, followingIds, servedIds, suppressedIds, mutedKeywords] =
      await Promise.all([
        this.favourites.getTargets(userId),
        this.follows.getFollowingIds(userId),
        this.served.getServed(userId),
        this.blocks.getSuppressedAuthorIds(userId),
        this.blocks.getMutedKeywords(userId),
      ]);

    const seenIds = new Set<string>(servedIds);
    for (const id of dto.seenIds ?? []) {
      seenIds.add(id);
    }

    const query: FeedQuery = {
      userId,
      page,
      pageSize,
      favourite,
      followingIds,
      seenIds,
      suppressedAuthorIds: new Set(suppressedIds),
      mutedKeywords,
    };

    const ranked = await this.runner.run(query, {
      sources: [this.favouriteSource, this.followSource, this.discoverySource],
      filters: [
        this.selfPostFilter,
        this.blockedAuthorFilter,
        this.mutedKeywordFilter,
        this.seenServedFilter,
      ],
      scorers: [
        this.weightedScorer,
        this.affinityScorer,
        this.oonScorer,
        this.authorDiversityScorer,
      ],
      selector: this.topKSelector,
    });

    const total = ranked.length;
    const { skip, take } = toSkipTake(page, pageSize);
    const pageCandidates = ranked.slice(skip, skip + take);
    const pagePosts = pageCandidates.map((c) => c.post);
    const mapped = await this.posts.mapWithUserState(pagePosts, {
      userId,
    } as AuthUser);

    // Side-effect: bu sayfada sunulanları işaretle (sonraki sayfa dedup).
    await this.served.markServed(
      userId,
      pagePosts.map((p) => p.id),
    );

    return buildPaged(mapped, total, page, pageSize);
  }
}
