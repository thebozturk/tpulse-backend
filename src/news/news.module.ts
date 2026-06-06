import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NEWS_REPOSITORY } from './news.repository';
import { NewsService } from './news.service';
import { PrismaNewsRepository } from './prisma-news.repository';

@Module({
  controllers: [NewsController],
  providers: [
    NewsService,
    { provide: NEWS_REPOSITORY, useClass: PrismaNewsRepository },
  ],
})
export class NewsModule {}
