import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import { CreateTransferDto, PatchTransferDto } from './dto/transfer-write.dto';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from './transfer.repository';

/** Admin transfer CRUD. create → notification.generate job (outbox). */
@Injectable()
export class AdminTransfersService {
  constructor(
    @Inject(TRANSFER_REPOSITORY) private readonly repo: ITransferRepository,
    private readonly outbox: OutboxService,
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
    const created = await this.repo.createTransfer({ ...dto, createdByUserId });
    await this.outbox.enqueue(OutboxEventType.NotificationGenerate, {
      transferId: created.id,
    });
    return created;
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
