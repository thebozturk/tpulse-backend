import { Module } from '@nestjs/common';
import { BlocksModule } from '../blocks/blocks.module';
import { ScoringModule } from '../common/scoring/scoring.module';
import { FavouritesModule } from '../favourites/favourites.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AdminPostsController } from './admin-posts.controller';
import { POST_REPOSITORY } from './post.repository';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PrismaPostRepository } from './prisma-post.repository';

@Module({
  imports: [MessagingModule, FavouritesModule, ScoringModule, BlocksModule],
  controllers: [PostsController, AdminPostsController],
  providers: [
    PostsService,
    { provide: POST_REPOSITORY, useClass: PrismaPostRepository },
  ],
  exports: [PostsService],
})
export class PostsModule {}
