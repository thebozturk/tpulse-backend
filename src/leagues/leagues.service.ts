import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { LeagueResponseDto } from './dto/league-response.dto';
import { toLeagueResponse } from './league.mapper';
import { ILeagueRepository, LEAGUE_REPOSITORY } from './league.repository';

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(LEAGUE_REPOSITORY) private readonly repo: ILeagueRepository,
  ) {}

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<LeagueResponseDto>> {
    const { items, total } = await this.repo.getAll(page, pageSize);
    return buildPaged(items.map(toLeagueResponse), total, page, pageSize);
  }

  async findById(id: string): Promise<LeagueResponseDto> {
    const league = await this.repo.getById(id);
    if (!league) {
      throw new NotFoundException('Lig bulunamadı');
    }
    return toLeagueResponse(league);
  }

  async findByCode(code: string): Promise<LeagueResponseDto> {
    const league = await this.repo.getByCode(code);
    if (!league) {
      throw new NotFoundException('Lig bulunamadı');
    }
    return toLeagueResponse(league);
  }
}
