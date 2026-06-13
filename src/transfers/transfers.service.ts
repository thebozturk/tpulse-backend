import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedSortQueryDto } from '../common/dto/pagination-query.dto';
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
import { Lang, pickName } from '../common/i18n/lang';
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
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:list', { ...filter, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.query(filter, false);
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
          total,
          filter.page,
          filter.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async findById(id: string, lang: Lang): Promise<TransferResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byId', { id, lang }),
      CacheTtl.List,
      async () => {
        const t = await this.repo.getById(id, false);
        if (!t) {
          throw new NotFoundException('Transfer bulunamadı');
        }
        return toTransferResponse(t, lang);
      },
      [CacheTag.Transfers],
    );
  }

  async latest(
    dto: LatestQueryDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:latest', {
        page: dto.page,
        pageSize: dto.pageSize,
        lang,
      }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getLatest(
          dto.page,
          dto.pageSize,
          false,
        );
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
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
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:topExpensive', { ...dto, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getTopExpensive(
          dto.currency,
          dto.page,
          dto.pageSize,
        );
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
          total,
          dto.page,
          dto.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async betweenTeams(
    dto: BetweenTeamsDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:betweenTeams', { ...dto, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getBetweenTeams(
          dto.fromTeamId,
          dto.toTeamId,
          dto.includeReverse,
          dto.page,
          dto.pageSize,
        );
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
          total,
          dto.page,
          dto.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async byYear(
    year: number,
    query: PagedSortQueryDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byYear', { year, ...query, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getByYear(
          year,
          query.page,
          query.pageSize,
          query.sort,
        );
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
          total,
          query.page,
          query.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async byMonth(
    year: number,
    month: number,
    query: PagedSortQueryDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:byMonth', {
        year,
        month,
        ...query,
        lang,
      }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getByMonth(
          year,
          month,
          query.page,
          query.pageSize,
          query.sort,
        );
        return buildPaged(
          items.map((t) => toTransferResponse(t, lang)),
          total,
          query.page,
          query.pageSize,
        );
      },
      [CacheTag.Transfers],
    );
  }

  async latestByLeagues(
    dto: LatestByLeaguesDto,
    lang: Lang,
  ): Promise<LeagueTransfersDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('transfers:latestByLeagues', { ...dto, lang }),
      CacheTtl.List,
      async () => {
        const groups = await this.repo.getLatestByAllLeagues(
          dto.take,
          dto.year,
        );
        return groups.map((g) => {
          const leagueName = pickName(lang, g.league.name, g.league.nameTr);
          return {
            league: {
              id: g.league.id,
              name: leagueName,
              logo: g.league.leagueLogo,
            },
            // Flat alanlar mobil için (bkz. LeagueTransfersDto)
            leagueId: g.league.id,
            leagueName,
            leagueLogo: g.league.leagueLogo,
            transfers: g.transfers.map((t) => toTeamTransferLine(t, lang)),
          };
        });
      },
      [CacheTag.Transfers],
    );
  }
}
