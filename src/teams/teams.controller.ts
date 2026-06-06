import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
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
  @ApiOperation({ summary: 'Takımları listele (paged)' })
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.teams.findAll(query.page, query.pageSize);
  }

  @Get('by-league/:leagueId')
  @ApiOperation({ summary: 'Lige göre takımlar' })
  async findByLeague(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
  ): Promise<ListResponse<TeamResponseDto>> {
    return { items: await this.teams.findByLeague(leagueId) };
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Takım detayı (kadro + son transferler)' })
  @ApiResponse({ status: 200, type: TeamDetailDto })
  @ApiResponse({ status: 404 })
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TeamDetailDto>> {
    return { data: await this.teams.getDetail(id) };
  }

  @Get(':teamId/incoming-transfers')
  @ApiOperation({ summary: 'Takıma gelen transferler' })
  async incoming(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'incoming') };
  }

  @Get(':teamId/outgoing-transfers')
  @ApiOperation({ summary: 'Takımdan giden transferler' })
  async outgoing(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'outgoing') };
  }

  @Get(':teamId/transfers')
  @ApiOperation({ summary: 'Takımın tüm transferleri (gelen+giden)' })
  async allTransfers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.teams.transfersOf(teamId, 'all') };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Takımı getir' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TeamResponseDto>> {
    return { data: await this.teams.findById(id) };
  }
}
