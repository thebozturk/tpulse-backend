import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { NewsResponseDto } from './dto/news-response.dto';
import {
  NewsBySourceDto,
  NewsDateRangeDto,
  NewsQueryDto,
} from './dto/news-query.dto';
import { toNewsResponse } from './news.mapper';
import { INewsRepository, NEWS_REPOSITORY } from './news.repository';

@Injectable()
export class NewsService {
  constructor(
    @Inject(NEWS_REPOSITORY) private readonly repo: INewsRepository,
  ) {}

  async findAll(query: NewsQueryDto): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getAll(
      query.page,
      query.pageSize,
      query.sortBy,
      query.order,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  async findById(id: string): Promise<NewsResponseDto> {
    const news = await this.repo.getById(id);
    if (!news) {
      throw new NotFoundException('Haber bulunamadı');
    }
    return toNewsResponse(news);
  }

  async findByPlayer(
    playerId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByPlayerId(
      playerId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findByToTeam(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByToTeamId(
      teamId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findByFromTeam(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByFromTeamId(
      teamId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findBySource(
    query: NewsBySourceDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getBySourceName(
      query.sourceName,
      query.page,
      query.pageSize,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  async findByDateRange(
    query: NewsDateRangeDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByDateRange(
      query.startDate,
      query.endDate,
      query.page,
      query.pageSize,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  private page(
    items: Parameters<typeof toNewsResponse>[0][],
    total: number,
    page: number,
    pageSize: number,
  ): PagedResult<NewsResponseDto> {
    return buildPaged(items.map(toNewsResponse), total, page, pageSize);
  }
}
