import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTag, CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
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
    private readonly cache: CacheService,
  ) {}

  async query(
    filter: TransferFilterDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:list', { ...filter }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.query(filter, false);
        return buildPaged(
          items.map(toTransferResponse),
          total,
          filter.page,
          filter.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async findById(id: string): Promise<TransferResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byId', { id }),
      CacheTtl.List,
      async () => {
        const t = await this.repo.getById(id, false);
        if (!t) {
          throw new NotFoundException('Transfer bulunamadı');
        }
        return toTransferResponse(t);
      },
      [CacheTag.Transfers],
    );
  }

  async latest(dto: LatestQueryDto): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:latest', {
        page: dto.page,
        pageSize: dto.pageSize,
      }),
      CacheTtl.List,
      async () => {
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
      },
      [CacheTag.Transfers],
    );
  }

  async topExpensive(
    dto: TopExpensiveDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:topExpensive', { ...dto }),
      CacheTtl.List,
      async () => {
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
      },
      [CacheTag.Transfers],
    );
  }

  async betweenTeams(dto: BetweenTeamsDto): Promise<TransferResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:betweenTeams', { ...dto }),
      CacheTtl.List,
      async () => {
        const items = await this.repo.getBetweenTeams(
          dto.fromTeamId,
          dto.toTeamId,
          dto.includeReverse,
        );
        return items.map(toTransferResponse);
      },
      [CacheTag.Transfers],
    );
  }

  async byYear(year: number): Promise<TransferResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byYear', { year }),
      CacheTtl.List,
      async () => (await this.repo.getByYear(year)).map(toTransferResponse),
      [CacheTag.Transfers],
    );
  }

  async byMonth(year: number, month: number): Promise<TransferResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byMonth', { year, month }),
      CacheTtl.List,
      async () =>
        (await this.repo.getByMonth(year, month)).map(toTransferResponse),
      [CacheTag.Transfers],
    );
  }

  async latestByLeagues(
    dto: LatestByLeaguesDto,
  ): Promise<LeagueTransfersDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:latestByLeagues', { ...dto }),
      CacheTtl.List,
      async () => {
        const groups = await this.repo.getLatestByAllLeagues(
          dto.take,
          dto.year,
        );
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
      },
      [CacheTag.Transfers],
    );
  }
}
