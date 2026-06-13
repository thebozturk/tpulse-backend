import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedSortQueryDto } from '../common/dto/pagination-query.dto';
import { Lang, pickName } from '../common/i18n/lang';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTag, CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { ImageUploadService } from '../storage/image-upload.service';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { TeamDetailDto } from './dto/team-detail.dto';
import { TeamFilterDto } from './dto/team-filter.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamWriteDto } from './dto/team-write.dto';
import {
  computeTeamSeasonTotals,
  toSquadPlayer,
  toTeamResponse,
} from './team.mapper';
import { ITeamRepository, TEAM_REPOSITORY } from './team.repository';

const RECENT_TAKE = 10;
const IMAGE_FOLDER = 'teams';
const IMAGE_QUALITY = 85;

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly repo: ITeamRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
    private readonly imageUpload: ImageUploadService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: TeamWriteDto): Promise<{ id: string }> {
    const created = await this.repo.create(dto);
    await this.cache.invalidateTags(CacheTag.Teams);
    return created;
  }

  async update(id: string, dto: TeamWriteDto): Promise<void> {
    if (!(await this.repo.update(id, dto))) {
      throw new NotFoundException('Takım bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Teams);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.remove(id))) {
      throw new NotFoundException('Takım bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Teams);
  }

  async setImageFromFile(
    id: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Takım bulunamadı');
    }
    const url = await this.imageUpload.fromFile(
      file,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Teams);
    return url;
  }

  async setImageFromUrl(id: string, imageUrl: string): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Takım bulunamadı');
    }
    const url = await this.imageUpload.fromUrl(
      imageUrl,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Teams);
    return url;
  }

  async deleteImage(id: string): Promise<void> {
    if (!(await this.repo.updateImage(id, null, false))) {
      throw new NotFoundException('Takım bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Teams);
  }

  async findAll(
    filter: TeamFilterDto,
    lang: Lang,
  ): Promise<PagedResult<TeamResponseDto>> {
    // "Hepsini çekme": en az bir filtre (lig veya isim araması) zorunlu.
    // Filtresiz istek tüm takımları döndürmez — boş sayfa döner.
    if (!filter.leagueId && !filter.search?.trim()) {
      return buildPaged([], 0, filter.page, filter.pageSize);
    }
    return this.cache.getOrSet(
      CacheService.buildKey('teams:list', { ...filter, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getAll(filter);
        return buildPaged(
          items.map((t) => toTeamResponse(t, lang)),
          total,
          filter.page,
          filter.pageSize,
        );
      },
      [CacheTag.Teams],
    );
  }

  async findById(id: string, lang: Lang): Promise<TeamResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:byId', { id, lang }),
      CacheTtl.List,
      async () => {
        const team = await this.repo.getById(id);
        if (!team) {
          throw new NotFoundException('Takım bulunamadı');
        }
        return toTeamResponse(team, lang);
      },
      [CacheTag.Teams],
    );
  }

  async findByLeague(
    leagueId: string,
    page: number,
    pageSize: number,
    lang: Lang,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:byLeague', {
        leagueId,
        page,
        pageSize,
        lang,
      }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getByLeagueId(
          leagueId,
          page,
          pageSize,
        );
        return buildPaged(
          items.map((t) => toTeamResponse(t, lang)),
          total,
          page,
          pageSize,
        );
      },
      [CacheTag.Teams],
    );
  }

  async getDetail(id: string, lang: Lang): Promise<TeamDetailDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:detail', { id, lang }),
      CacheTtl.List,
      () => this.computeDetail(id, lang),
      [CacheTag.Teams, CacheTag.Transfers, CacheTag.Players],
    );
  }

  private async computeDetail(id: string, lang: Lang): Promise<TeamDetailDto> {
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
      name: pickName(lang, team.name, team.nameTr),
      nameTr: team.nameTr ?? undefined,
      logo: team.logo ?? undefined,
      founded: team.founded ?? undefined,
      venueName: team.venueName ?? undefined,
      venueCity: team.venueCity ?? undefined,
      venueCapacity: team.venueCapacity ?? undefined,
      leagueId: team.leagueId,
      leagueName: pickName(lang, team.league.name, team.league.nameTr),
      leagueLogo: team.league.leagueLogo,
      playerCount: team._count.players,
      seasonTotals: computeTeamSeasonTotals(team.players, team.leagueId),
      squad: team.players.map((p) => toSquadPlayer(p, lang, team.leagueId)),
      recentIncoming: recentIncoming.map((t) => toTeamTransferLine(t, lang)),
      recentOutgoing: recentOutgoing.map((t) => toTeamTransferLine(t, lang)),
    };
  }

  async transfersOf(
    teamId: string,
    direction: 'incoming' | 'outgoing' | 'all',
    query: PagedSortQueryDto,
    lang: Lang,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:transfers', {
        teamId,
        direction,
        ...query,
        lang,
      }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.transfers.getByTeamDirectional(
          teamId,
          direction,
          query.page,
          query.pageSize,
          query.sort,
        );
        return buildPaged(
          items.map((t) => toTeamTransferLine(t, lang)),
          total,
          query.page,
          query.pageSize,
        );
      },
      [CacheTag.Teams, CacheTag.Transfers],
    );
  }
}
