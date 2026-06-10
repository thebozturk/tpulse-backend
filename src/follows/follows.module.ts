import { Module } from '@nestjs/common';
import { FOLLOW_REPOSITORY } from './follow.repository';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { PrismaFollowRepository } from './prisma-follow.repository';

@Module({
  controllers: [FollowsController],
  providers: [
    FollowsService,
    { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
  ],
  exports: [FollowsService],
})
export class FollowsModule {}
