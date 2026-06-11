import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { Lang } from '../common/i18n/lang';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { LatestQueryDto, RumourFilterDto } from './dto/transfer-query.dto';
import { toTransferResponse } from './transfer.mapper';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from './transfer.repository';

@Injectable()
export class RumoursService {
  constructor(
    @Inject(TRANSFER_REPOSITORY) private readonly repo: ITransferRepository,
  ) {}

  async query(
    filter: RumourFilterDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    const { items, total } = await this.repo.query(filter, true);
    return buildPaged(
      items.map((t) => toTransferResponse(t, lang)),
      total,
      filter.page,
      filter.pageSize,
    );
  }

  async findById(id: string, lang: Lang): Promise<TransferResponseDto> {
    const t = await this.repo.getById(id, true);
    if (!t) {
      throw new NotFoundException('Söylenti bulunamadı');
    }
    return toTransferResponse(t, lang);
  }

  async latest(
    dto: LatestQueryDto,
    lang: Lang,
  ): Promise<PagedResult<TransferResponseDto>> {
    const { items, total } = await this.repo.getLatest(
      dto.page,
      dto.pageSize,
      true,
    );
    return buildPaged(
      items.map((t) => toTransferResponse(t, lang)),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async byPlayer(playerId: string, lang: Lang): Promise<TransferResponseDto[]> {
    return (await this.repo.getByPlayerIdRumour(playerId)).map((t) =>
      toTransferResponse(t, lang),
    );
  }

  async byTeam(teamId: string, lang: Lang): Promise<TransferResponseDto[]> {
    return (await this.repo.getByTeamIdRumour(teamId)).map((t) =>
      toTransferResponse(t, lang),
    );
  }
}
