import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { LeagueTransferFilterDto } from '../transfers/dto/transfer-query.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { LeagueResponseDto } from './dto/league-response.dto';
import { LeagueTransfersQueryDto } from './dto/league-transfers-query.dto';
import { toLeagueResponse } from './league.mapper';
import { ILeagueRepository, LEAGUE_REPOSITORY } from './league.repository';

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(LEAGUE_REPOSITORY) private readonly repo: ILeagueRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
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

  async transfers_(
    leagueId: string,
    query: LeagueTransfersQueryDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    const { items, total } = await this.transfers.getByLeagueId(
      leagueId,
      query.year,
      query.page,
      query.pageSize,
    );
    return buildPaged(
      items.map(toTeamTransferLine),
      total,
      query.page,
      query.pageSize,
    );
  }

  async latestTransfers(
    leagueId: string,
    take: number,
    year?: number,
  ): Promise<TeamTransferLineDto[]> {
    const items = await this.transfers.getLatestByLeagueId(
      leagueId,
      take,
      year,
    );
    return items.map(toTeamTransferLine);
  }

  async directionalTransfers(
    leagueId: string,
    direction: 'incoming' | 'outgoing',
    filter: LeagueTransferFilterDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    const { items, total } = await this.transfers.getLeagueDirectional(
      leagueId,
      direction,
      filter,
    );
    return buildPaged(
      items.map(toTeamTransferLine),
      total,
      filter.page,
      filter.pageSize,
    );
  }
}
