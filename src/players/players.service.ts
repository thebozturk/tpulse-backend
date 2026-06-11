import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Lang } from '../common/i18n/lang';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTag, CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { NewsService } from '../news/news.service';
import { PostsService } from '../posts/posts.service';
import { ImageUploadService } from '../storage/image-upload.service';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { PlayerProfileDto } from './dto/player-profile.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerWriteDto } from './dto/player-write.dto';
import { toPlayerResponse } from './player.mapper';
import { IPlayerRepository, PLAYER_REPOSITORY } from './player.repository';

const IMAGE_FOLDER = 'players';
const IMAGE_QUALITY = 85;
const PROFILE_TRANSFERS = 20;
const PROFILE_NEWS = 10;
const PROFILE_POSTS = 10;

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PLAYER_REPOSITORY) private readonly repo: IPlayerRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
    private readonly imageUpload: ImageUploadService,
    private readonly news: NewsService,
    private readonly posts: PostsService,
    private readonly cache: CacheService,
  ) {}

  async getProfile(id: string, lang: Lang): Promise<PlayerProfileDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:profile', { id, lang }),
      CacheTtl.List,
      async () => {
        const player = await this.repo.getById(id);
        if (!player) {
          throw new NotFoundException('Oyuncu bulunamadı');
        }
        const [transfers, newsPaged, posts] = await Promise.all([
          this.transfers.getByPlayerId(id),
          this.news.findByPlayer(id, 1, PROFILE_NEWS, lang),
          this.posts.byPlayer(id, undefined, lang),
        ]);
        return {
          player: toPlayerResponse(player, lang),
          transfers: transfers
            .slice(0, PROFILE_TRANSFERS)
            .map((t) => toTeamTransferLine(t, lang)),
          news: newsPaged.items,
          posts: posts.slice(0, PROFILE_POSTS),
        };
      },
      [CacheTag.Players, CacheTag.Transfers],
    );
  }

  async create(dto: PlayerWriteDto): Promise<{ id: string }> {
    const created = await this.repo.create(dto);
    await this.cache.invalidateTags(CacheTag.Players);
    return created;
  }

  async updatePlayer(id: string, dto: PlayerWriteDto): Promise<void> {
    if (!(await this.repo.update(id, dto))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Players);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.remove(id))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Players);
  }

  async setImageFromFile(
    id: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    const url = await this.imageUpload.fromFile(
      file,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Players);
    return url;
  }

  async setImageFromUrl(id: string, imageUrl: string): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    const url = await this.imageUpload.fromUrl(
      imageUrl,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Players);
    return url;
  }

  async deleteImage(id: string): Promise<void> {
    if (!(await this.repo.updateImage(id, null, false))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Players);
  }

  async findAll(
    filter: PlayerFilterDto,
    lang: Lang,
  ): Promise<PagedResult<PlayerResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:list', { ...filter, lang }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getAll(filter);
        return buildPaged(
          items.map((p) => toPlayerResponse(p, lang)),
          total,
          filter.page,
          filter.pageSize,
        );
      },
      [CacheTag.Players],
    );
  }

  async findById(id: string, lang: Lang): Promise<PlayerResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:byId', { id, lang }),
      CacheTtl.List,
      async () => {
        const player = await this.repo.getById(id);
        if (!player) {
          throw new NotFoundException('Oyuncu bulunamadı');
        }
        return toPlayerResponse(player, lang);
      },
      [CacheTag.Players],
    );
  }

  async findByTeam(teamId: string, lang: Lang): Promise<PlayerResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:byTeam', { teamId, lang }),
      CacheTtl.List,
      async () =>
        (await this.repo.getByTeamId(teamId)).map((p) =>
          toPlayerResponse(p, lang),
        ),
      [CacheTag.Players],
    );
  }

  async findByNationality(
    nationality: string,
    lang: Lang,
  ): Promise<PlayerResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:byNationality', { nationality, lang }),
      CacheTtl.List,
      async () =>
        (await this.repo.getByNationality(nationality)).map((p) =>
          toPlayerResponse(p, lang),
        ),
      [CacheTag.Players],
    );
  }

  async findFreeAgents(lang: Lang): Promise<PlayerResponseDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:freeAgents', { lang }),
      CacheTtl.List,
      async () =>
        (await this.repo.getFreeAgents()).map((p) => toPlayerResponse(p, lang)),
      [CacheTag.Players],
    );
  }

  async transfersOf(playerId: string): Promise<TeamTransferLineDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:transfers', { playerId }),
      CacheTtl.List,
      async () =>
        (await this.transfers.getByPlayerId(playerId)).map((t) =>
          toTeamTransferLine(t),
        ),
      [CacheTag.Players, CacheTag.Transfers],
    );
  }

  async lastTransfer(playerId: string): Promise<TeamTransferLineDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('players:lastTransfer', { playerId }),
      CacheTtl.List,
      async () => {
        const last = await this.transfers.getLastByPlayerId(playerId);
        if (!last) {
          throw new NotFoundException('Transfer bulunamadı');
        }
        return toTeamTransferLine(last);
      },
      [CacheTag.Players, CacheTag.Transfers],
    );
  }
}
