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
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.query(filter);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Son transferler' })
  @ApiPagedResponse(TransferResponseDto)
  latest(
    @Query() dto: LatestQueryDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.latest(dto);
  }

  @Get('top-expensive')
  @ApiOperation({ summary: 'En pahalı transferler' })
  @ApiPagedResponse(TransferResponseDto)
  topExpensive(
    @Query() dto: TopExpensiveDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.topExpensive(dto);
  }

  @Get('between-teams')
  @ApiOperation({ summary: 'İki takım arası transferler' })
  @ApiListResponse(TransferResponseDto)
  async betweenTeams(
    @Query() dto: BetweenTeamsDto,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.betweenTeams(dto) };
  }

  @Get('by-year/:year')
  @ApiOperation({ summary: 'Yıla göre transferler' })
  @ApiListResponse(TransferResponseDto)
  async byYear(
    @Param('year', ParseIntPipe) year: number,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.byYear(year) };
  }

  @Get('by-month/:year/:month')
  @ApiOperation({ summary: 'Ay/yıla göre transferler' })
  @ApiListResponse(TransferResponseDto)
  async byMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.byMonth(year, month) };
  }

  @Get('latest-by-leagues')
  @ApiOperation({ summary: 'Liglere göre son transferler' })
  @ApiListResponse(LeagueTransfersDto)
  async latestByLeagues(
    @Query() dto: LatestByLeaguesDto,
  ): Promise<ListResponse<LeagueTransfersDto>> {
    return { items: await this.transfers.latestByLeagues(dto) };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Transfer istatistikleri' })
  @ApiResponse({ status: 200, type: TransferStatsDto })
  getStats(@Query() filter: StatsFilterDto): Promise<TransferStatsDto> {
    return this.stats.getStats(filter);
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
  ): Promise<TransferPeriodSummaryDto> {
    return this.stats.getPeriodSummary(query);
  }

  @Get('season-dashboard')
  @ApiOperation({ summary: 'Sezon dashboard (topN + baseCurrency)' })
  @ApiResponse({ status: 200, type: TransferSeasonDashboardDto })
  @ApiResponse({ status: 400 })
  seasonDashboard(
    @Query() query: SeasonDashboardQueryDto,
  ): Promise<TransferSeasonDashboardDto> {
    return this.stats.getSeasonDashboard(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Transferi getir' })
  @ApiSingleResponse(TransferResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TransferResponseDto>> {
    return { data: await this.transfers.findById(id) };
  }
}
