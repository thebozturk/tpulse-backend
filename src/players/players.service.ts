import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { ImageUploadService } from '../storage/image-upload.service';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerWriteDto } from './dto/player-write.dto';
import { toPlayerResponse } from './player.mapper';
import { IPlayerRepository, PLAYER_REPOSITORY } from './player.repository';

const IMAGE_FOLDER = 'players';
const IMAGE_QUALITY = 85;

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PLAYER_REPOSITORY) private readonly repo: IPlayerRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
    private readonly imageUpload: ImageUploadService,
  ) {}

  create(dto: PlayerWriteDto): Promise<{ id: string }> {
    return this.repo.create(dto);
  }

  async updatePlayer(id: string, dto: PlayerWriteDto): Promise<void> {
    if (!(await this.repo.update(id, dto))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.remove(id))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
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
    return url;
  }

  async deleteImage(id: string): Promise<void> {
    if (!(await this.repo.updateImage(id, null, false))) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
  }

  async findAll(
    filter: PlayerFilterDto,
  ): Promise<PagedResult<PlayerResponseDto>> {
    const { items, total } = await this.repo.getAll(filter);
    return buildPaged(
      items.map(toPlayerResponse),
      total,
      filter.page,
      filter.pageSize,
    );
  }

  async findById(id: string): Promise<PlayerResponseDto> {
    const player = await this.repo.getById(id);
    if (!player) {
      throw new NotFoundException('Oyuncu bulunamadı');
    }
    return toPlayerResponse(player);
  }

  async findByTeam(teamId: string): Promise<PlayerResponseDto[]> {
    return (await this.repo.getByTeamId(teamId)).map(toPlayerResponse);
  }

  async findByNationality(nationality: string): Promise<PlayerResponseDto[]> {
    return (await this.repo.getByNationality(nationality)).map(
      toPlayerResponse,
    );
  }

  async findFreeAgents(): Promise<PlayerResponseDto[]> {
    return (await this.repo.getFreeAgents()).map(toPlayerResponse);
  }

  async transfersOf(playerId: string): Promise<TeamTransferLineDto[]> {
    return (await this.transfers.getByPlayerId(playerId)).map(
      toTeamTransferLine,
    );
  }

  async lastTransfer(playerId: string): Promise<TeamTransferLineDto> {
    const last = await this.transfers.getLastByPlayerId(playerId);
    if (!last) {
      throw new NotFoundException('Transfer bulunamadı');
    }
    return toTeamTransferLine(last);
  }
}
