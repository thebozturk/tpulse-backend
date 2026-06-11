import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Lang } from '../common/i18n/lang';
import { ReqLang } from '../common/i18n/lang.decorator';
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
import { PlayerSearchDto } from '../search/dto/search-query.dto';
import { SearchService } from '../search/search.service';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { PlayerProfileDto } from './dto/player-profile.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('api/players')
@Public()
export class PlayersController {
  constructor(
    private readonly players: PlayersService,
    private readonly search: SearchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Oyuncuları listele (filtre + paged)' })
  @ApiPagedResponse(PlayerResponseDto)
  findAll(
    @Query() filter: PlayerFilterDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.players.findAll(filter, lang);
  }

  @Get('free-agents')
  @ApiOperation({ summary: 'Serbest oyuncular' })
  @ApiListResponse(PlayerResponseDto)
  async freeAgents(
    @ReqLang() lang: Lang,
  ): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findFreeAgents(lang) };
  }

  @Get('search')
  @ApiOperation({ summary: 'Oyuncu fuzzy arama (paged) — bot kullanır' })
  @ApiPagedResponse(PlayerResponseDto)
  @ApiResponse({ status: 400, description: 'query boş' })
  searchPlayers(
    @Query() query: PlayerSearchDto,
    @ReqLang() lang: Lang,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.search.searchPlayersPaged(query, lang);
  }

  @Get('by-team/:teamId')
  @ApiOperation({ summary: 'Takıma göre oyuncular' })
  @ApiListResponse(PlayerResponseDto)
  async byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @ReqLang() lang: Lang,
  ): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findByTeam(teamId, lang) };
  }

  @Get('by-nationality/:nationality')
  @ApiOperation({ summary: 'Uyruğa göre oyuncular' })
  @ApiListResponse(PlayerResponseDto)
  async byNationality(
    @Param('nationality') nationality: string,
    @ReqLang() lang: Lang,
  ): Promise<ListResponse<PlayerResponseDto>> {
    return { items: await this.players.findByNationality(nationality, lang) };
  }

  @Get(':id/profile')
  @Public()
  @ApiOperation({ summary: 'Oyuncu profili (transfer+haber+post)' })
  @ApiSingleResponse(PlayerProfileDto)
  @ApiResponse({ status: 404 })
  async profile(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<PlayerProfileDto>> {
    return { data: await this.players.getProfile(id, lang) };
  }

  @Get(':playerId/transfers')
  @ApiOperation({ summary: 'Oyuncunun transferleri' })
  @ApiListResponse(TeamTransferLineDto)
  async transfers(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<ListResponse<TeamTransferLineDto>> {
    return { items: await this.players.transfersOf(playerId) };
  }

  @Get(':playerId/last-transfer')
  @ApiOperation({ summary: 'Oyuncunun son transferi' })
  @ApiSingleResponse(TeamTransferLineDto)
  @ApiResponse({ status: 404 })
  async lastTransfer(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<SingleResponse<TeamTransferLineDto>> {
    return { data: await this.players.lastTransfer(playerId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Oyuncuyu getir' })
  @ApiSingleResponse(PlayerResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLang() lang: Lang,
  ): Promise<SingleResponse<PlayerResponseDto>> {
    return { data: await this.players.findById(id, lang) };
  }
}
