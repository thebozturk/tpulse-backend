import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  NewsBySourceDto,
  NewsDateRangeDto,
  NewsQueryDto,
  NewsSortQueryDto,
} from './dto/news-query.dto';
import { NewsResponseDto } from './dto/news-response.dto';
import { NewsService } from './news.service';
import { ReqLang } from '../common/i18n/lang.decorator';
import { Lang } from '../common/i18n/lang';

@ApiTags('news')
@Controller('api/news')
@Public()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Haberleri listele (paged + sort)' })
  @ApiPagedResponse(NewsResponseDto)
  findAll(
    @Query() query: NewsQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findAll(query, lang);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Kaynak çipleri — kullanılan farklı kaynak adları' })
  @ApiResponse({ status: 200, type: [String] })
  async sources(): Promise<ListResponse<string>> {
    return { items: await this.news.listSources() };
  }

  @Get('by-source')
  @ApiOperation({ summary: 'Kaynaga gore haberler' })
  @ApiPagedResponse(NewsResponseDto)
  bySource(
    @Query() query: NewsBySourceDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findBySource(query, lang);
  }

  @Get('by-date-range')
  @ApiOperation({ summary: 'Tarih araligina gore haberler' })
  @ApiPagedResponse(NewsResponseDto)
  byDateRange(
    @Query() query: NewsDateRangeDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByDateRange(query, lang);
  }

  @Get('by-player/:playerId')
  @ApiOperation({ summary: 'Oyuncuya gore haberler (paged + sort)' })
  @ApiPagedResponse(NewsResponseDto)
  byPlayer(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Query() query: NewsSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByPlayer(playerId, query, lang);
  }

  @Get('by-team/:teamId')
  @ApiOperation({ summary: 'Hedef takima gore haberler (paged + sort)' })
  @ApiPagedResponse(NewsResponseDto)
  byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: NewsSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByToTeam(teamId, query, lang);
  }

  @Get('from-team/:teamId')
  @ApiOperation({ summary: 'Kaynak takima gore haberler (paged + sort)' })
  @ApiPagedResponse(NewsResponseDto)
  fromTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: NewsSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<NewsResponseDto>> {
    return this.news.findByFromTeam(teamId, query, lang);
  }

  @Get(':newsId')
  @ApiOperation({ summary: 'Haberi getir' })
  @ApiSingleResponse(NewsResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<NewsResponseDto>> {
    return { data: await this.news.findById(newsId, lang) };
  }
}
