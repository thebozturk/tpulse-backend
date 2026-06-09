import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { CacheTag, CacheTtl } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { ImageUploadService } from '../storage/image-upload.service';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { LeagueTransferFilterDto } from '../transfers/dto/transfer-query.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { LeagueResponseDto } from './dto/league-response.dto';
import { LeagueTransfersQueryDto } from './dto/league-transfers-query.dto';
import { LeagueWriteDto } from './dto/league-write.dto';
import { toLeagueResponse } from './league.mapper';
import { ILeagueRepository, LEAGUE_REPOSITORY } from './league.repository';

const IMAGE_FOLDER = 'leagues';
const IMAGE_QUALITY = 90;

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(LEAGUE_REPOSITORY) private readonly repo: ILeagueRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
    private readonly imageUpload: ImageUploadService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: LeagueWriteDto): Promise<{ id: string }> {
    const created = await this.repo.create(dto);
    await this.cache.invalidateTags(CacheTag.Leagues);
    return created;
  }

  async update(id: string, dto: LeagueWriteDto): Promise<void> {
    if (!(await this.repo.update(id, dto))) {
      throw new NotFoundException('Lig bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Leagues);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.remove(id))) {
      throw new NotFoundException('Lig bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Leagues);
  }

  async setImageFromFile(
    id: string,
    file: Express.Multer.File,
  ): Promise<string> {
    await this.ensureExists(id);
    const url = await this.imageUpload.fromFile(
      file,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Leagues);
    return url;
  }

  async setImageFromUrl(id: string, imageUrl: string): Promise<string> {
    await this.ensureExists(id);
    const url = await this.imageUpload.fromUrl(
      imageUrl,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url, true);
    await this.cache.invalidateTags(CacheTag.Leagues);
    return url;
  }

  async deleteImage(id: string): Promise<void> {
    if (!(await this.repo.updateImage(id, null, false))) {
      throw new NotFoundException('Lig bulunamadı');
    }
    await this.cache.invalidateTags(CacheTag.Leagues);
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Lig bulunamadı');
    }
  }

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<LeagueResponseDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:list', { page, pageSize }),
      CacheTtl.List,
      async () => {
        const { items, total } = await this.repo.getAll(page, pageSize);
        return buildPaged(items.map(toLeagueResponse), total, page, pageSize);
      },
      [CacheTag.Leagues],
    );
  }

  async findById(id: string): Promise<LeagueResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:byId', { id }),
      CacheTtl.List,
      async () => {
        const league = await this.repo.getById(id);
        if (!league) {
          throw new NotFoundException('Lig bulunamadı');
        }
        return toLeagueResponse(league);
      },
      [CacheTag.Leagues],
    );
  }

  async findByCode(code: string): Promise<LeagueResponseDto> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:byCode', { code }),
      CacheTtl.List,
      async () => {
        const league = await this.repo.getByCode(code);
        if (!league) {
          throw new NotFoundException('Lig bulunamadı');
        }
        return toLeagueResponse(league);
      },
      [CacheTag.Leagues],
    );
  }

  async transfers_(
    leagueId: string,
    query: LeagueTransfersQueryDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:transfers', { leagueId, ...query }),
      CacheTtl.List,
      async () => {
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
      },
      [CacheTag.Leagues, CacheTag.Transfers],
    );
  }

  async latestTransfers(
    leagueId: string,
    take: number,
    year?: number,
  ): Promise<TeamTransferLineDto[]> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:latestTransfers', {
        leagueId,
        take,
        year,
      }),
      CacheTtl.List,
      async () => {
        const items = await this.transfers.getLatestByLeagueId(
          leagueId,
          take,
          year,
        );
        return items.map(toTeamTransferLine);
      },
      [CacheTag.Leagues, CacheTag.Transfers],
    );
  }

  async directionalTransfers(
    leagueId: string,
    direction: 'incoming' | 'outgoing',
    filter: LeagueTransferFilterDto,
  ): Promise<PagedResult<TeamTransferLineDto>> {
    return this.cache.getOrSet(
      CacheService.buildKey('leagues:directionalTransfers', {
        leagueId,
        direction,
        ...filter,
      }),
      CacheTtl.List,
      async () => {
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
      },
      [CacheTag.Leagues, CacheTag.Transfers],
    );
  }
}
