import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { TeamTransferLineDto } from '../transfers/dto/team-transfer-line.dto';
import { toTeamTransferLine } from '../transfers/transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { toPlayerResponse } from './player.mapper';
import { IPlayerRepository, PLAYER_REPOSITORY } from './player.repository';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PLAYER_REPOSITORY) private readonly repo: IPlayerRepository,
    @Inject(TRANSFER_REPOSITORY)
    private readonly transfers: ITransferRepository,
  ) {}

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
