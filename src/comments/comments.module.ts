import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { AdminCommentsController } from './admin-comments.controller';
import { CommentController } from './comment.controller';
import { COMMENT_REPOSITORY } from './comment.repository';
import { CommentsService } from './comments.service';
import { PrismaCommentRepository } from './prisma-comment.repository';

@Module({
  imports: [MessagingModule],
  controllers: [CommentController, AdminCommentsController],
  providers: [
    CommentsService,
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
  ],
  exports: [CommentsService],
})
export class CommentsModule {}
