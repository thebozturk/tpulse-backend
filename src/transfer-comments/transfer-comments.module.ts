import { Module } from '@nestjs/common';
import { PrismaTransferCommentRepository } from './prisma-transfer-comment.repository';
import { TransferCommentController } from './transfer-comment.controller';
import { TRANSFER_COMMENT_REPOSITORY } from './transfer-comment.repository';
import { TransferCommentsService } from './transfer-comments.service';

@Module({
  controllers: [TransferCommentController],
  providers: [
    TransferCommentsService,
    {
      provide: TRANSFER_COMMENT_REPOSITORY,
      useClass: PrismaTransferCommentRepository,
    },
  ],
})
export class TransferCommentsModule {}
