import { Module } from '@nestjs/common';
import { BLOCK_REPOSITORY } from './block.repository';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { MutedKeywordsController } from './muted-keywords.controller';
import { PrismaBlockRepository } from './prisma-block.repository';

@Module({
  controllers: [BlocksController, MutedKeywordsController],
  providers: [
    BlocksService,
    { provide: BLOCK_REPOSITORY, useClass: PrismaBlockRepository },
  ],
  exports: [BlocksService],
})
export class BlocksModule {}
