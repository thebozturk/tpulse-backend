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
import { LeagueTransfersDto } from './dto/league-transfers.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import {
  BetweenTeamsDto,
  LatestByLeaguesDto,
  LatestQueryDto,
  TopExpensiveDto,
  TransferFilterDto,
} from './dto/transfer-query.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@Controller('api/transfers')
@Public()
export class TransferQueryController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Transferleri filtrele (paged)' })
  findAll(
    @Query() filter: TransferFilterDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.query(filter);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Son transferler' })
  latest(
    @Query() dto: LatestQueryDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.latest(dto);
  }

  @Get('top-expensive')
  @ApiOperation({ summary: 'En pahalı transferler' })
  topExpensive(
    @Query() dto: TopExpensiveDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.transfers.topExpensive(dto);
  }

  @Get('between-teams')
  @ApiOperation({ summary: 'İki takım arası transferler' })
  async betweenTeams(
    @Query() dto: BetweenTeamsDto,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.betweenTeams(dto) };
  }

  @Get('by-year/:year')
  @ApiOperation({ summary: 'Yıla göre transferler' })
  async byYear(
    @Param('year', ParseIntPipe) year: number,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.byYear(year) };
  }

  @Get('by-month/:year/:month')
  @ApiOperation({ summary: 'Ay/yıla göre transferler' })
  async byMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.transfers.byMonth(year, month) };
  }

  @Get('latest-by-leagues')
  @ApiOperation({ summary: 'Liglere göre son transferler' })
  async latestByLeagues(
    @Query() dto: LatestByLeaguesDto,
  ): Promise<ListResponse<LeagueTransfersDto>> {
    return { items: await this.transfers.latestByLeagues(dto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Transferi getir' })
  @ApiResponse({ status: 200, type: TransferResponseDto })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TransferResponseDto>> {
    return { data: await this.transfers.findById(id) };
  }
}
