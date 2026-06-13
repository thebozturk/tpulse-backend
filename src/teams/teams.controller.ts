import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import {
  PaginationQueryDto,
  PagedSortQueryDto,
} from '../common/dto/pagination-query.dto';
import { TeamFilterDto } from './dto/team-filter.dto';
import { ReqLang } from '../common/i18n/lang.decorator';
import { Lang } from '../common/i18n/lang';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { TeamDetailDto } from './dto/team-detail.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('api/teams')
@Public()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Takim listele (paged)' })
  @ApiPagedResponse(TeamResponseDto)
  findAll(
    @Query() query: TeamFilterDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.teams.findAll(query.page, query.pageSize, lang, query.search);
  }

  @Get('by-league/:leagueId')
  @ApiOperation({ summary: 'Lige gore takimlar (paged)' })
  @ApiPagedResponse(TeamResponseDto)
  @ApiResponse({ status: 404 })
  findByLeague(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query() query: PaginationQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.teams.findByLeague(leagueId, query.page, query.pageSize, lang);
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Takim detayi (kadro + son transferler)' })
  @ApiSingleResponse(TeamDetailDto)
  @ApiResponse({ status: 404 })
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<TeamDetailDto>> {
    return { data: await this.teams.getDetail(id, lang) };
  }

  @Get(':teamId/incoming-transfers')
  @ApiOperation({ summary: 'Takima gelen transferler (paged)' })
  @ApiPagedResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  incoming(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: PagedSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.teams.transfersOf(teamId, 'incoming', query, lang);
  }

  @Get(':teamId/outgoing-transfers')
  @ApiOperation({ summary: 'Takimdan giden transferler (paged)' })
  @ApiPagedResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  outgoing(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: PagedSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.teams.transfersOf(teamId, 'outgoing', query, lang);
  }

  @Get(':teamId/transfers')
  @ApiOperation({ summary: 'Takimin tum transferleri (gelen+giden, paged)' })
  @ApiPagedResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  allTransfers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: PagedSortQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.teams.transfersOf(teamId, 'all', query, lang);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Takimi getir' })
  @ApiSingleResponse(TeamResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<TeamResponseDto>> {
    return { data: await this.teams.findById(id, lang) };
  }
}
