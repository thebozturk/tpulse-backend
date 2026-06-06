import { Module } from '@nestjs/common';
import { PrismaSearchRepository } from './prisma-search.repository';
import { SearchController } from './search.controller';
import { SEARCH_REPOSITORY } from './search.repository';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    { provide: SEARCH_REPOSITORY, useClass: PrismaSearchRepository },
  ],
  exports: [SearchService],
})
export class SearchModule {}
