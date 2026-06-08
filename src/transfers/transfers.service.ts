import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { LeagueTransfersDto } from './dto/league-transfers.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import {
  BetweenTeamsDto,
  LatestByLeaguesDto,
  LatestQueryDto,
  TopExpensiveDto,
  TransferFilterDto,
} from './dto/transfer-query.dto';
import { toTeamTransferLine, toTransferResponse } from './transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from './transfer.repository';

@Injectable()
export class TransfersService {
  constructor(
    @Inject(TRANSFER_REPOSITORY) private readonly repo: ITransferRepository,
  ) {}

  async query(
    filter: TransferFilterDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    const { items, total } = await this.repo.query(filter, false);
    return buildPaged(
      items.map(toTransferResponse),
      total,
      filter.page,
      filter.pageSize,
    );
  }

  async findById(id: string): Promise<TransferResponseDto> {
    const t = await this.repo.getById(id, false);
    if (!t) {
      throw new NotFoundException('Transfer bulunamadı');
    }
    return toTransferResponse(t);
  }

  async latest(dto: LatestQueryDto): Promise<PagedResult<TransferResponseDto>> {
    const { items, total } = await this.repo.getLatest(
      dto.page,
      dto.pageSize,
      false,
    );
    return buildPaged(
      items.map(toTransferResponse),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async topExpensive(
    dto: TopExpensiveDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    const { items, total } = await this.repo.getTopExpensive(
      dto.currency,
      dto.page,
      dto.pageSize,
    );
    return buildPaged(
      items.map(toTransferResponse),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async betweenTeams(dto: BetweenTeamsDto): Promise<TransferResponseDto[]> {
    const items = await this.repo.getBetweenTeams(
      dto.fromTeamId,
      dto.toTeamId,
      dto.includeReverse,
    );
    return items.map(toTransferResponse);
  }

  async byYear(year: number): Promise<TransferResponseDto[]> {
    return (await this.repo.getByYear(year)).map(toTransferResponse);
  }

  async byMonth(year: number, month: number): Promise<TransferResponseDto[]> {
    return (await this.repo.getByMonth(year, month)).map(toTransferResponse);
  }

  async latestByLeagues(
    dto: LatestByLeaguesDto,
  ): Promise<LeagueTransfersDto[]> {
    const groups = await this.repo.getLatestByAllLeagues(dto.take, dto.year);
    return groups.map((g) => ({
      league: {
        id: g.league.id,
        name: g.league.name,
        logo: g.league.leagueLogo,
      },
      // Flat alanlar mobil için (bkz. LeagueTransfersDto)
      leagueId: g.league.id,
      leagueName: g.league.name,
      leagueLogo: g.league.leagueLogo,
      transfers: g.transfers.map(toTeamTransferLine),
    }));
  }
}
