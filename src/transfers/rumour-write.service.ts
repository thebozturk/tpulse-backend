import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
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
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateRumourDto, userId: string): Promise<{ id: string }> {
    // Söylenti kaydı + bildirim event'i atomik (transfer create ile aynı garanti).
    const created = await this.prisma.$transaction(async (tx) => {
      const c = await this.repo.createRumour(
        {
          playerId: dto.playerId,
          fromTeamId: dto.fromTeamId,
          toTeamId: dto.toTeamId,
          feeAmount: dto.feeAmount ?? 0,
          feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
          createdByUserId: userId,
        },
        tx,
      );
      await this.notify(c.id, tx);
      return c;
    });
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
    // Confirm (isRumour:false) + bildirim event'i atomik.
    await this.prisma.$transaction(async (tx) => {
      await this.repo.confirmRumour(id, dto, tx);
      await this.notify(id, tx); // artık isRumour:false → Transfer bildirimi
    });
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

  private notify(
    transferId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.outbox.enqueue(
      OutboxEventType.NotificationGenerate,
      { transferId },
      tx,
    );
  }
}
