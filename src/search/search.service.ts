import { Inject, Injectable } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { PlayerResponseDto } from '../players/dto/player-response.dto';
import { toPlayerResponse } from '../players/player.mapper';
import { PlayerSearchDto, SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-result.dto';
import { ISearchRepository, SEARCH_REPOSITORY } from './search.repository';

@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_REPOSITORY) private readonly repo: ISearchRepository,
    private readonly cache: CacheService,
  ) {}

  async search(dto: SearchQueryDto): Promise<SearchResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('search:all', {
        q: dto.q?.toLowerCase().trim(),
        limit: dto.limit,
      }),
      CacheTtl.Search,
      () => this.runSearch(dto),
    );
  }

  private async runSearch(dto: SearchQueryDto): Promise<SearchResponseDto> {
    const [players, teams, leagues] = await Promise.all([
      this.repo.searchPlayers(dto.q, dto.limit),
      this.repo.searchTeams(dto.q, dto.limit),
      this.repo.searchLeagues(dto.q, dto.limit),
    ]);
    return {
      query: dto.q,
      data: {
        players: players.map((p) => ({
          type: 'player' as const,
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          imageUrl: p.photo ?? undefined,
          subtitle: p.nationality,
        })),
        teams: teams.map((t) => ({
          type: 'team' as const,
          id: t.id,
          name: t.name,
          imageUrl: t.logo ?? undefined,
        })),
        leagues: leagues.map((l) => ({
          type: 'league' as const,
          id: l.id,
          name: l.name,
          imageUrl: l.leagueLogo,
          subtitle: l.country,
        })),
      },
    };
  }

  async searchPlayersPaged(
    dto: PlayerSearchDto,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('search:players', {
        query: dto.query?.toLowerCase().trim(),
        page: dto.page,
        pageSize: dto.pageSize,
      }),
      CacheTtl.Search,
      async () => {
        const { items, total } = await this.repo.searchPlayersPaged(
          dto.query,
          dto.page,
          dto.pageSize,
        );
        return buildPaged(
          items.map(toPlayerResponse),
          total,
          dto.page,
          dto.pageSize,
        );
      },
    );
  }
}
