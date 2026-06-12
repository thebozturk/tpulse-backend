import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, TransferSource } from '@prisma/client';
import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { NEWS_REPOSITORY, INewsRepository } from '../news/news.repository';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import {
  ITransferRepository,
  TRANSFER_REPOSITORY,
} from '../transfers/transfer.repository';
import { IngestPostDto } from './dto/ingest-post.dto';
import {
  ProjectionTarget,
  resolveProjectionTarget,
} from './projection-target.resolver';
import { ResolvedShape } from './post-shape.resolver';

const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_FEE = 0;
const NEWS_TITLE_MAX = 120;
const SLUG_MAX = 256;
const SLUG_SOURCE_SUFFIX = 12;

export interface ProjectionInput {
  postId: string;
  shape: ResolvedShape;
  category: BotContentCategory;
  dto: IngestPostDto;
  ownerId: string;
}

export interface ProjectionResult {
  projectedAs: ProjectionTarget;
  transferId?: string;
  newsId?: string;
}

/**
 * Bot ingest yansıması: Post create ile AYNI transaction içinde içeriği
 * kategorisine göre Transfer / Duyum / News'e de yazar (fan-out).
 * Çağıran (IngestionService) `tx`'i sağlar → atomiklik garanti.
 */
@Injectable()
export class IngestProjectionService {
  private readonly logger = new Logger(IngestProjectionService.name);

  constructor(
    @Inject(TRANSFER_REPOSITORY)
    private readonly transferRepo: ITransferRepository,
    @Inject(NEWS_REPOSITORY) private readonly newsRepo: INewsRepository,
    private readonly outbox: OutboxService,
  ) {}

  async project(
    tx: Prisma.TransactionClient,
    input: ProjectionInput,
  ): Promise<ProjectionResult> {
    const target = resolveProjectionTarget(
      input.shape.postType,
      input.category,
    );
    switch (target) {
      case 'rumour':
        return this.projectRumour(tx, input);
      case 'transfer':
        return this.projectTransfer(tx, input);
      case 'news':
        return this.projectNews(tx, input);
      case 'none':
      default:
        return { projectedAs: 'none' };
    }
  }

  private async projectRumour(
    tx: Prisma.TransactionClient,
    { shape, dto, ownerId }: ProjectionInput,
  ): Promise<ProjectionResult> {
    const created = await this.transferRepo.createRumour(
      {
        playerId: shape.playerId,
        fromTeamId: shape.fromTeamId,
        toTeamId: shape.toTeamId,
        feeAmount: dto.feeAmount ?? DEFAULT_FEE,
        feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
        createdByUserId: ownerId,
        source: TransferSource.Bot,
        sourceId: dto.sourceId,
      },
      tx,
    );
    await this.notifyTransfer(created.id, tx);
    return { projectedAs: 'rumour', transferId: created.id };
  }

  private async projectTransfer(
    tx: Prisma.TransactionClient,
    { shape, dto, ownerId }: ProjectionInput,
  ): Promise<ProjectionResult> {
    const transferDate = dto.transferDate ?? new Date();
    // Dedup: aynı üçlü için açık duyum varsa onu resmiye çevir (yeni kayıt açma).
    const openRumour = await this.transferRepo.findOpenRumour(
      shape.playerId,
      shape.fromTeamId,
      shape.toTeamId,
    );
    if (openRumour) {
      await this.transferRepo.confirmRumour(
        openRumour.id,
        {
          feeAmount: dto.feeAmount ?? DEFAULT_FEE,
          feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
          transferDate,
        },
        tx,
      );
      await this.notifyTransfer(openRumour.id, tx);
      return { projectedAs: 'transfer', transferId: openRumour.id };
    }

    const created = await this.transferRepo.createTransfer(
      {
        playerId: shape.playerId,
        fromTeamId: shape.fromTeamId,
        toTeamId: shape.toTeamId,
        transferDate,
        feeAmount: dto.feeAmount ?? DEFAULT_FEE,
        feeCurrency: dto.feeCurrency ?? DEFAULT_CURRENCY,
        createdByUserId: ownerId,
        source: TransferSource.Bot,
        sourceId: dto.sourceId,
      },
      tx,
    );
    await this.notifyTransfer(created.id, tx);
    return { projectedAs: 'transfer', transferId: created.id };
  }

  private async projectNews(
    tx: Prisma.TransactionClient,
    { shape, dto }: ProjectionInput,
  ): Promise<ProjectionResult> {
    const title = this.deriveTitle(dto.text);
    const created = await this.newsRepo.create(
      {
        title,
        slug: this.deriveSlug(title, dto.sourceId),
        content: dto.text,
        publishDate: new Date(),
        playerId: shape.playerId,
        fromTeamId: shape.fromTeamId,
        toTeamId: shape.toTeamId,
        imageUrl: dto.imageUrl,
        sourceName: this.deriveSourceName(dto.sourceUrl),
        sourceUrl: dto.sourceUrl,
        sourceId: dto.sourceId,
      },
      tx,
    );
    return { projectedAs: 'news', newsId: created.id };
  }

  private notifyTransfer(
    transferId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    return this.outbox.enqueue(
      OutboxEventType.NotificationGenerate,
      { transferId },
      tx,
    );
  }

  /** Bot metninden haber başlığı: ilk satır, ~120 char'a kısaltılır. */
  private deriveTitle(text: string): string {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length <= NEWS_TITLE_MAX) {
      return firstLine;
    }
    return `${firstLine.slice(0, NEWS_TITLE_MAX - 1).trimEnd()}…`;
  }

  /** Türkçe karakterleri sadeleştirip slug üretir; sourceId eki ile benzersizleştirir. */
  private deriveSlug(title: string, sourceId: string): string {
    const map: Record<string, string> = {
      ç: 'c',
      ğ: 'g',
      ı: 'i',
      ö: 'o',
      ş: 's',
      ü: 'u',
    };
    const base = title
      .toLowerCase()
      .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = sourceId.slice(-SLUG_SOURCE_SUFFIX);
    const slug = `${base}-${suffix}`;
    return slug.slice(0, SLUG_MAX);
  }

  private deriveSourceName(sourceUrl?: string): string {
    if (!sourceUrl) {
      return 'TransferPulse';
    }
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'TransferPulse';
    }
  }
}
