import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ApiListResponse,
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { LeagueTransferFilterDto } from '../transfers/dto/transfer-query.dto';
import { LeagueResponseDto } from './dto/league-response.dto';
import {
  LeagueLatestTransfersDto,
  LeagueTransfersQueryDto,
} from './dto/league-transfers-query.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('leagues')
@Controller('api/leagues')
@Public()
export class LeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Get()
  @ApiOperation({ summary: 'Ligleri listele (paged)' })
  @ApiPagedResponse(LeagueResponseDto)
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<LeagueResponseDto>> {
    return this.leagues.findAll(query.page, query.pageSize);
  }

  @Get('by-code/:code')
  @ApiOperation({ summary: 'Lig kodu ile getir' })
  @ApiSingleResponse(LeagueResponseDto)
  @ApiResponse({ status: 404 })
  async findByCode(
    @Param('code') code: string,
  ): Promise<SingleResponse<LeagueResponseDto>> {
    return { data: await this.leagues.findByCode(code) };
  }

  @Get(':leagueId/transfers/latest')
  @ApiOperation({ summary: 'Ligin son transferleri' })
  @ApiListResponse(TeamTransferLineDto)
  async latestTransfers(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query() dto: LeagueLatestTransfersDto,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return {
      items: await this.leagues.latestTransfers(leagueId, dto.take, dto.year),
    };
  }

  @Get(':leagueId/transfers/incoming')
  @ApiOperation({ summary: 'Lige gelen transferler' })
  @ApiPagedResponse(TeamTransferLineDto)
  incoming(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query() filter: LeagueTransferFilterDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.leagues.directionalTransfers(leagueId, 'incoming', filter);
  }

  @Get(':leagueId/transfers/outgoing')
  @ApiOperation({ summary: 'Ligden giden transferler' })
  @ApiPagedResponse(TeamTransferLineDto)
  outgoing(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query() filter: LeagueTransferFilterDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.leagues.directionalTransfers(leagueId, 'outgoing', filter);
  }

  @Get(':leagueId/transfers')
  @ApiOperation({ summary: 'Ligin transferleri (paged)' })
  @ApiPagedResponse(TeamTransferLineDto)
  leagueTransfers(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query() query: LeagueTransfersQueryDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.leagues.transfers_(leagueId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ligi getir' })
  @ApiSingleResponse(LeagueResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<LeagueResponseDto>> {
    return { data: await this.leagues.findById(id) };
  }
}
