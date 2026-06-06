import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { POST_REPOSITORY } from './post.repository';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PrismaPostRepository } from './prisma-post.repository';

@Module({
  imports: [MessagingModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    { provide: POST_REPOSITORY, useClass: PrismaPostRepository },
  ],
})
export class PostsModule {}
