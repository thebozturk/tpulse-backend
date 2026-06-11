import { Inject, Injectable } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { Lang, pickName } from '../common/i18n/lang';
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

  async search(dto: SearchQueryDto, lang: Lang): Promise<SearchResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('search:all', {
        q: dto.q?.toLowerCase().trim(),
        limit: dto.limit,
        lang,
      }),
      CacheTtl.Search,
      () => this.runSearch(dto, lang),
    );
  }

  private async runSearch(
    dto: SearchQueryDto,
    lang: Lang,
  ): Promise<SearchResponseDto> {
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
          name: `${pickName(lang, p.firstName, p.firstNameTr)} ${pickName(lang, p.lastName, p.lastNameTr)}`,
          imageUrl: p.photo ?? undefined,
          subtitle: p.nationality,
        })),
        teams: teams.map((t) => ({
          type: 'team' as const,
          id: t.id,
          name: pickName(lang, t.name, t.nameTr),
          imageUrl: t.logo ?? undefined,
        })),
        leagues: leagues.map((l) => ({
          type: 'league' as const,
          id: l.id,
          name: pickName(lang, l.name, l.nameTr),
          imageUrl: l.leagueLogo,
          subtitle: l.country,
        })),
      },
    };
  }

  async searchPlayersPaged(
    dto: PlayerSearchDto,
    lang: Lang,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('search:players', {
        query: dto.query?.toLowerCase().trim(),
        page: dto.page,
        pageSize: dto.pageSize,
        lang,
      }),
      CacheTtl.Search,
      async () => {
        const { items, total } = await this.repo.searchPlayersPaged(
          dto.query,
          dto.page,
          dto.pageSize,
        );
        return buildPaged(
          items.map((p) => toPlayerResponse(p, lang)),
          total,
          dto.page,
          dto.pageSize,
        );
      },
    );
  }
}
