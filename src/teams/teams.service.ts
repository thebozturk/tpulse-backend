import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamWriteDto } from './dto/team-write.dto';
import { toSquadPlayer, toTeamResponse } from './team.mapper';
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
    page: number,
    pageSize: number,
  ): Promise<PagedResult<TeamResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:list', { page, pageSize }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getAll(page, pageSize);
        return buildPaged(items.map(toTeamResponse), total, page, pageSize);
      },
      [CacheTag.Teams],
    );
  }

  async findById(id: string): Promise<TeamResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:byId', { id }),
      CacheTtl.List,
      async () => {
        const team = await this.repo.getById(id);
        if (!team) {
          throw new NotFoundException('Takım bulunamadı');
        }
        return toTeamResponse(team);
      },
      [CacheTag.Teams],
    );
  }

  async findByLeague(leagueId: string): Promise<TeamResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:byLeague', { leagueId }),
      CacheTtl.List,
      async () => {
        const teams = await this.repo.getByLeagueId(leagueId);
        return teams.map(toTeamResponse);
      },
      [CacheTag.Teams],
    );
  }

  async getDetail(id: string): Promise<TeamDetailDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('teams:detail', { id }),
      CacheTtl.List,
      () => this.computeDetail(id),
      [CacheTag.Teams, CacheTag.Transfers],
    );
  }

  private async computeDetail(id: string): Promise<TeamDetailDto> {
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
    return this.cache.getOrSet(
      CacheService.buildKey('teams:transfers', { teamId, direction }),
      CacheTtl.List,
      async () => {
        const items = await this.transfers.getByTeamDirectional(
          teamId,
          direction,
        );
        return items.map(toTeamTransferLine);
      },
      [CacheTag.Teams, CacheTag.Transfers],
    );
  }
}
