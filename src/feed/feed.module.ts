import { Module } from '@nestjs/common';
import { BlocksModule } from '../blocks/blocks.module';
import { FavouritesModule } from '../favourites/favourites.module';
import { FollowsModule } from '../follows/follows.module';
import { PostsModule } from '../posts/posts.module';
import { FeedConfig } from './feed.config';
import { FeedController } from './feed.controller';
import { FEED_REPOSITORY } from './feed.repository';
import { FeedServedStore } from './feed-served.store';
import { FeedService } from './feed.service';
import { BlockedAuthorFilter } from './filters/blocked-author.filter';
import { MutedKeywordFilter } from './filters/muted-keyword.filter';
import { SeenServedFilter } from './filters/seen-served.filter';
import { SelfPostFilter } from './filters/self-post.filter';
import { PipelineRunner } from './pipeline/pipeline.runner';
import { PrismaFeedRepository } from './prisma-feed.repository';
import { AffinityScorer } from './scorers/affinity.scorer';
import { AuthorDiversityScorer } from './scorers/author-diversity.scorer';
import { OonScorer } from './scorers/oon.scorer';
import { WeightedScorer } from './scorers/weighted.scorer';
import { TopKSelector } from './selectors/top-k.selector';
import { DiscoverySource } from './sources/discovery.source';
import { FavouriteSource } from './sources/favourite.source';
import { FollowSource } from './sources/follow.source';

@Module({
  imports: [FavouritesModule, FollowsModule, BlocksModule, PostsModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    FeedConfig,
    FeedServedStore,
    PipelineRunner,
    FavouriteSource,
    FollowSource,
    DiscoverySource,
    SelfPostFilter,
    BlockedAuthorFilter,
    MutedKeywordFilter,
    SeenServedFilter,
    WeightedScorer,
    AffinityScorer,
    OonScorer,
    AuthorDiversityScorer,
    TopKSelector,
    { provide: FEED_REPOSITORY, useClass: PrismaFeedRepository },
  ],
})
export class FeedModule {}
