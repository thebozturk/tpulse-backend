import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './team.mapper';
import { ITeamRepository, TEAM_REPOSITORY } from './team.repository';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly repo: ITeamRepository,
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
}
