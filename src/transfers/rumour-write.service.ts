import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CacheTag } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import { ConfirmRumourDto, CreateRumourDto } from './dto/rumour-write.dto';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from './transfer.repository';

const DEFAULT_CURRENCY = 'EUR';

@Injectable()
export class RumourWriteService {
  constructor(
    @Inject(TRANSFER_REPOSITORY) private readonly repo: ITransferRepository,
    private readonly outbox: OutboxService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateRumourDto, userId: string): Promise<{ id: string }> {
    const created = await this.repo.createRumour({
      playerId: dto.playerId,
      fromTeamId: dto.fromTeamId,
      toTeamId: dto.toTeamId,
      feeAmount: dto.feeAmount ?? 0,
      feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
      createdByUserId: userId,
    });
    await this.notify(created.id);
    await this.cache.invalidateTags(CacheTag.Transfers);
    return created;
  }

  async update(
    id: string,
    user: AuthUser,
    dto: CreateRumourDto,
  ): Promise<void> {
    await this.assertAuthorOrAdmin(id, user);
    await this.repo.updateRumour(id, {
      playerId: dto.playerId,
      fromTeamId: dto.fromTeamId,
      toTeamId: dto.toTeamId,
      feeAmount: dto.feeAmount ?? 0,
      feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
    });
    await this.cache.invalidateTags(CacheTag.Transfers);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.assertAuthorOrAdmin(id, user);
    await this.repo.softDelete(id);
    await this.cache.invalidateTags(CacheTag.Transfers);
  }

  async confirm(
    id: string,
    dto: ConfirmRumourDto,
  ): Promise<{ transferId: string }> {
    const meta = await this.repo.getRumourMeta(id);
    if (!meta) {
      throw new NotFoundException('Söylenti bulunamadı');
    }
    await this.repo.confirmRumour(id, dto);
    await this.notify(id); // artık isRumour:false → Transfer bildirimi
    await this.cache.invalidateTags(CacheTag.Transfers);
    return { transferId: id };
  }

  private async assertAuthorOrAdmin(id: string, user: AuthUser): Promise<void> {
    const meta = await this.repo.getRumourMeta(id);
    if (!meta) {
      throw new NotFoundException('Söylenti bulunamadı');
    }
    if (meta.createdByUserId !== user.userId && user.role !== 'Admin') {
      throw new ForbiddenException('Bu söylenti sana ait değil');
    }
  }

  private notify(transferId: string): Promise<void> {
    return this.outbox.enqueue(OutboxEventType.NotificationGenerate, {
      transferId,
    });
  }
}
