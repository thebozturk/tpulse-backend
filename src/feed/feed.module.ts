import { Module } from '@nestjs/common';
import { FavouritesModule } from '../favourites/favourites.module';
import { FollowsModule } from '../follows/follows.module';
import { PostsModule } from '../posts/posts.module';
import { FeedConfig } from './feed.config';
import { FeedController } from './feed.controller';
import { FEED_REPOSITORY } from './feed.repository';
import { FeedService } from './feed.service';
import { PipelineRunner } from './pipeline/pipeline.runner';
import { PrismaFeedRepository } from './prisma-feed.repository';
import { AffinityScorer } from './scorers/affinity.scorer';
import { WeightedScorer } from './scorers/weighted.scorer';
import { TopKSelector } from './selectors/top-k.selector';
import { FavouriteSource } from './sources/favourite.source';
import { FollowSource } from './sources/follow.source';

@Module({
  imports: [FavouritesModule, FollowsModule, PostsModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    FeedConfig,
    PipelineRunner,
    FavouriteSource,
    FollowSource,
    WeightedScorer,
    AffinityScorer,
    TopKSelector,
    { provide: FEED_REPOSITORY, useClass: PrismaFeedRepository },
  ],
})
export class FeedModule {}
