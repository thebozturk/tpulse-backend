import { Module } from '@nestjs/common';
import { AdminNewsController } from './admin-news.controller';
import { NewsController } from './news.controller';
import { NewsImageController } from './news-image.controller';
import { NEWS_REPOSITORY } from './news.repository';
import { NewsService } from './news.service';
import { PrismaNewsRepository } from './prisma-news.repository';

@Module({
  controllers: [NewsController, AdminNewsController, NewsImageController],
  providers: [
    NewsService,
    { provide: NEWS_REPOSITORY, useClass: PrismaNewsRepository },
  ],
  exports: [NewsService, NEWS_REPOSITORY],
})
export class NewsModule {}
