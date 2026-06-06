import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { TeamDetailDto } from './dto/team-detail.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { toSquadPlayer, toTeamResponse } from './team.mapper';
import { ITeamRepository, TEAM_REPOSITORY } from './team.repository';

const RECENT_TAKE = 10;

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly repo: ITeamRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
  ) {}

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<TeamResponseDto>> {
    const { items, total } = await this.repo.getAll(page, pageSize);
    return buildPaged(items.map(toTeamResponse), total, page, pageSize);
  }

  async findById(id: string): Promise<TeamResponseDto> {
    const team = await this.repo.getById(id);
    if (!team) {
      throw new NotFoundException('Takım bulunamadı');
    }
    return toTeamResponse(team);
  }

  async findByLeague(leagueId: string): Promise<TeamResponseDto[]> {
    const teams = await this.repo.getByLeagueId(leagueId);
    return teams.map(toTeamResponse);
  }

  async getDetail(id: string): Promise<TeamDetailDto> {
    const team = await this.repo.getDetailById(id);
    if (!team) {
      throw new NotFoundException('Takım bulunamadı');
    }
    const [recentIncoming, recentOutgoing] = await Promise.all([
      this.transfers.getRecentByTeam(id, 'incoming', RECENT_TAKE),
      this.transfers.getRecentByTeam(id, 'outgoing', RECENT_TAKE),
    ]);
    return {
      id: team.id,
      name: team.name,
      logo: team.logo ?? undefined,
      founded: team.founded ?? undefined,
      venueName: team.venueName ?? undefined,
      venueCity: team.venueCity ?? undefined,
      venueCapacity: team.venueCapacity ?? undefined,
      leagueId: team.leagueId,
      leagueName: team.league.name,
      leagueLogo: team.league.leagueLogo,
      playerCount: team._count.players,
      squad: team.players.map(toSquadPlayer),
      recentIncoming: recentIncoming.map(toTeamTransferLine),
      recentOutgoing: recentOutgoing.map(toTeamTransferLine),
    };
  }

  async transfersOf(
    teamId: string,
    direction: 'incoming' | 'outgoing' | 'all',
  ): Promise<TeamTransferLineDto[]> {
    const items = await this.transfers.getByTeamDirectional(teamId, direction);
    return items.map(toTeamTransferLine);
  }
}
