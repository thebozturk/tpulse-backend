import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('api/players')
@Public()
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'Oyuncuları listele (filtre + paged)' })
  findAll(
    @Query() filter: PlayerFilterDto,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.players.findAll(filter);
  }

  @Get('free-agents')
  @ApiOperation({ summary: 'Serbest oyuncular' })
  async freeAgents(): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findFreeAgents() };
  }

  @Get('by-team/:teamId')
  @ApiOperation({ summary: 'Takıma göre oyuncular' })
  async byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findByTeam(teamId) };
  }

  @Get('by-nationality/:nationality')
  @ApiOperation({ summary: 'Uyruğa göre oyuncular' })
  async byNationality(
    @Param('nationality') nationality: string,
  ): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findByNationality(nationality) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Oyuncuyu getir' })
  @ApiResponse({ status: 200, type: PlayerResponseDto })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<PlayerResponseDto>> {
    return { data: await this.players.findById(id) };
  }
}
