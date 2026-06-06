import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransferDto, PatchTransferDto } from './dto/transfer-write.dto';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from './transfer.repository';

/**
 * Admin transfer CRUD. NOT: docs'a göre create "bildirim tetikler" — notification
 * Faz 6'da eklenecek (burada saf CRUD).
 */
@Injectable()
export class AdminTransfersService {
  constructor(
    @Inject(TRANSFER_REPOSITORY) private readonly repo: ITransferRepository,
  ) {}

  async create(
    dto: CreateTransferDto,
    createdByUserId: string,
  ): Promise<{ id: string }> {
    const dup = await this.repo.existsDuplicate(
      dto.playerId,
      dto.fromTeamId,
      dto.toTeamId,
      dto.transferDate,
    );
    if (dup) {
      throw new ConflictException('Aynı transfer zaten mevcut');
    }
    return this.repo.createTransfer({ ...dto, createdByUserId });
  }

  async update(id: string, dto: CreateTransferDto): Promise<void> {
    if (!(await this.repo.updateTransfer(id, dto))) {
      throw new NotFoundException('Transfer bulunamadı');
    }
  }

  async patch(id: string, dto: PatchTransferDto): Promise<void> {
    if (!(await this.repo.patchTransfer(id, dto))) {
      throw new NotFoundException('Transfer bulunamadı');
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.softDelete(id))) {
      throw new NotFoundException('Transfer bulunamadı');
    }
  }
}
