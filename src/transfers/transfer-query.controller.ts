import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PagedSortQueryDto } from '../common/dto/pagination-query.dto';
import { ReqLang } from '../common/i18n/lang.decorator';
import { Lang } from '../common/i18n/lang';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  ApiListResponse,
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import { LeagueTransfersDto } from './dto/league-transfers.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import {
  BetweenTeamsDto,
  LatestByLeaguesDto,
  LatestQueryDto,
  TopExpensiveDto,
  TransferFilterDto,
} from './dto/transfer-query.dto';
import { TransferPeriodSummaryDto } from './stats/dto/period-summary.dto';
import { TransferSeasonDashboardDto } from './stats/dto/season-dashboard.dto';
import {
  PeriodSummaryQueryDto,
  PeriodsQueryDto,
  SeasonDashboardQueryDto,
  StatsFilterDto,
} from './stats/dto/stats-query.dto';
import { TransferPeriodDto } from './stats/dto/transfer-period.dto';
import { TransferStatsDto } from './stats/dto/transfer-stats.dto';
import { StatsService } from './stats/stats.service';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@Controller('api/transfers')
@Public()
export class TransferQueryController {
  constructor(
    private readonly transfers: TransfersService,
    private readonly stats: StatsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Transferleri filtrele (paged)' })
  @ApiPagedResponse(TransferResponseDto)
  findAll(
    @Query() filter: TransferFilterDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.query(filter, lang);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Son transferler' })
  @ApiPagedResponse(TransferResponseDto)
  latest(
    @Query() dto: LatestQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.latest(dto, lang);
  }

  @Get('top-expensive')
  @ApiOperation({ summary: 'En pahalı transferler' })
  @ApiPagedResponse(TransferResponseDto)
  topExpensive(
    @Query() dto: TopExpensiveDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.topExpensive(dto, lang);
  }

  @Get('between-teams')
  @ApiOperation({ summary: 'İki takım arası transferler (paged)' })
  @ApiPagedResponse(TransferResponseDto)
  betweenTeams(
    @Query() dto: BetweenTeamsDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.betweenTeams(dto, lang);
  }

  @Get('by-year/:year')
  @ApiOperation({ summary: 'Yıla göre transferler (paged)' })
  @ApiPagedResponse(TransferResponseDto)
  byYear(
    @Param('year', ParseIntPipe) year: number,
    @Query() query: PagedSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.byYear(year, query, lang);
  }

  @Get('by-month/:year/:month')
  @ApiOperation({ summary: 'Ay/yıla göre transferler (paged)' })
  @ApiPagedResponse(TransferResponseDto)
  byMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query() query: PagedSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.byMonth(year, month, query, lang);
  }

  @Get('latest-by-leagues')
  @ApiOperation({ summary: 'Liglere göre son transferler' })
  @ApiListResponse(LeagueTransfersDto)
  async latestByLeagues(
    @Query() dto: LatestByLeaguesDto,
    @ReqLang() lang: Lang,
  ): Promise<ListResponse<LeagueTransfersDto>> {
    return { items: await this.transfers.latestByLeagues(dto, lang) };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Transfer istatistikleri' })
  @ApiResponse({ status: 200, type: TransferStatsDto })
  getStats(
    @Query() filter: StatsFilterDto,
    @ReqLang() lang: Lang,
  ): Promise<TransferStatsDto> {
    return this.stats.getStats(filter, lang);
  }

  @Get('periods')
  @ApiOperation({ summary: 'Transfer dönemleri' })
  @ApiListResponse(TransferPeriodDto)
  @ApiResponse({ status: 400, description: 'Geçersiz yıl' })
  async periods(
    @Query() query: PeriodsQueryDto,
  ): Promise<ListResponse<TransferPeriodDto>> {
    return { items: await this.stats.getPeriods(query) };
  }

  @Get('period-summary')
  @ApiOperation({ summary: 'Dönem özeti (baseCurrency çevrimi)' })
  @ApiResponse({ status: 200, type: TransferPeriodSummaryDto })
  @ApiResponse({
    status: 400,
    description: 'year veya transferPeriodId zorunlu',
  })
  periodSummary(
    @Query() query: PeriodSummaryQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<TransferPeriodSummaryDto> {
    return this.stats.getPeriodSummary(query, lang);
  }

  @Get('season-dashboard')
  @ApiOperation({ summary: 'Sezon dashboard (topN + baseCurrency)' })
  @ApiResponse({ status: 200, type: TransferSeasonDashboardDto })
  @ApiResponse({ status: 400 })
  seasonDashboard(
    @Query() query: SeasonDashboardQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<TransferSeasonDashboardDto> {
    return this.stats.getSeasonDashboard(query, lang);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Transferi getir' })
  @ApiSingleResponse(TransferResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<TransferResponseDto>> {
    return { data: await this.transfers.findById(id, lang) };
  }
}
