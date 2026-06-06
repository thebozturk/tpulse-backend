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
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.teams.findAll(query.page, query.pageSize);
  }

  @Get('by-league/:leagueId')
  @ApiOperation({ summary: 'Lige gore takimlar' })
  @ApiListResponse(TeamResponseDto)
  @ApiResponse({ status: 404 })
  async findByLeague(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
  ): Promise<ListResponse<TeamResponseDto>> {
    return { items: await this.teams.findByLeague(leagueId) };
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Takim detayi (kadro + son transferler)' })
  @ApiSingleResponse(TeamDetailDto)
  @ApiResponse({ status: 404 })
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TeamDetailDto>> {
    return { data: await this.teams.getDetail(id) };
  }

  @Get(':teamId/incoming-transfers')
  @ApiOperation({ summary: 'Takima gelen transferler' })
  @ApiListResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  async incoming(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'incoming') };
  }

  @Get(':teamId/outgoing-transfers')
  @ApiOperation({ summary: 'Takimdan giden transferler' })
  @ApiListResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  async outgoing(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'outgoing') };
  }

  @Get(':teamId/transfers')
  @ApiOperation({ summary: 'Takimin tum transferleri (gelen+giden)' })
  @ApiListResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  async allTransfers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'all') };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Takimi getir' })
  @ApiSingleResponse(TeamResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TeamResponseDto>> {
    return { data: await this.teams.findById(id) };
  }
}
