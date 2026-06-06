import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { PostsModule } from '../posts/posts.module';
import { TransferCommentsModule } from '../transfer-comments/transfer-comments.module';
import { UsersModule } from '../users/users.module';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [UsersModule, PostsModule, CommentsModule, TransferCommentsModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
