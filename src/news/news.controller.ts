import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  NewsBySourceDto,
  NewsDateRangeDto,
  NewsQueryDto,
} from './dto/news-query.dto';
import { NewsResponseDto } from './dto/news-response.dto';
import { NewsService } from './news.service';

@ApiTags('news')
@Controller('api/news')
@Public()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Haberleri listele (paged + sort)' })
  findAll(@Query() query: NewsQueryDto): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findAll(query);
  }

  @Get('by-source')
  @ApiOperation({ summary: 'Kaynağa göre haberler' })
  bySource(
    @Query() query: NewsBySourceDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findBySource(query);
  }

  @Get('by-date-range')
  @ApiOperation({ summary: 'Tarih aralığına göre haberler' })
  byDateRange(
    @Query() query: NewsDateRangeDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByDateRange(query);
  }

  @Get('by-player/:playerId')
  @ApiOperation({ summary: 'Oyuncuya göre haberler' })
  byPlayer(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Query() page: PaginationQueryDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByPlayer(playerId, page.page, page.pageSize);
  }

  @Get('by-team/:teamId')
  @ApiOperation({ summary: 'Hedef takıma göre haberler' })
  byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() page: PaginationQueryDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByToTeam(teamId, page.page, page.pageSize);
  }

  @Get('from-team/:teamId')
  @ApiOperation({ summary: 'Kaynak takıma göre haberler' })
  fromTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() page: PaginationQueryDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByFromTeam(teamId, page.page, page.pageSize);
  }

  @Get(':newsId')
  @ApiOperation({ summary: 'Haberi getir' })
  @ApiResponse({ status: 200, type: NewsResponseDto })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('newsId', ParseUUIDPipe) newsId: string,
  ): Promise<SingleResponse<NewsResponseDto>> {
    return { data: await this.news.findById(newsId) };
  }
}
