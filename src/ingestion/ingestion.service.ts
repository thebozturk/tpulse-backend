import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditAction } from '../common/audit/audit-actions';
import { AuditService } from '../common/audit/audit.service';
import { BOT_CATEGORY_BY_KEY } from '../common/enums/bot-content-category.enum';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheTag } from '../common/redis/cache-tags';
import { CacheService } from '../common/redis/cache.service';
import { IngestPostDto } from './dto/ingest-post.dto';
import { IngestResultDto } from './dto/ingest-result.response.dto';
import { IngestProjectionService } from './ingest-projection.service';
import { resolvePostShape } from './post-shape.resolver';

const SYSTEM_USERNAME = 'transferpulse';
const SYSTEM_EMAIL = 'bot@transferpulse.app';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private systemUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projection: IngestProjectionService,
    private readonly cache: CacheService,
  ) {}

  /** Bot içeriğini TransferPulse sistem kullanıcısı adına Post olarak ekler (idempotent). */
  async ingestPost(dto: IngestPostDto): Promise<IngestResultDto> {
    // Idempotency: aynı tweet daha önce alındıysa yeni kayıt açma.
    const existing = await this.prisma.post.findUnique({
      where: { sourceId: dto.sourceId },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id, status: 'duplicate' };
    }

    const ownerId = await this.getSystemUserId();
    const category = BOT_CATEGORY_BY_KEY[dto.category];
    const shape = resolvePostShape(dto);

    try {
      // Post + içerik yansıması (Transfer/Duyum/News) tek transaction → atomik.
      const { post, projection } = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.post.create({
            data: {
              ownerId,
              content: dto.text,
              postType: shape.postType,
              category,
              sourceId: dto.sourceId,
              sourceUrl: dto.sourceUrl,
              imageUrl: dto.imageUrl,
              playerId: shape.playerId,
              teamId: shape.teamId,
              fromTeamId: shape.fromTeamId,
              toTeamId: shape.toTeamId,
            },
            select: { id: true },
          });
          const projected = await this.projection.project(tx, {
            postId: created.id,
            shape,
            category,
            dto,
            ownerId,
          });
          return { post: created, projection: projected };
        },
      );

      // Transfer/Duyum yansıdıysa transfer cache'ini düşür.
      if (
        projection.projectedAs === 'rumour' ||
        projection.projectedAs === 'transfer'
      ) {
        await this.cache.invalidateTags(CacheTag.Transfers);
      }

      await this.audit.log({
        actorUserId: ownerId,
        action: AuditAction.BotIngest,
        targetType: 'Post',
        targetId: post.id,
        metadata: {
          sourceId: dto.sourceId,
          category: dto.category,
          projectedAs: projection.projectedAs,
          transferId: projection.transferId,
          newsId: projection.newsId,
        },
      });

      this.logger.log(
        `Bot içeriği eklendi: ${post.id} (${dto.sourceId}) → ${projection.projectedAs}`,
      );
      return {
        id: post.id,
        status: 'created',
        projectedAs: projection.projectedAs,
        transferId: projection.transferId,
        newsId: projection.newsId,
      };
    } catch (err) {
      // Yarış durumunda unique ihlali → duplicate olarak ele al.
      if (this.isUniqueViolation(err)) {
        const dup = await this.prisma.post.findUnique({
          where: { sourceId: dto.sourceId },
          select: { id: true },
        });
        if (dup) {
          return { id: dup.id, status: 'duplicate' };
        }
      }
      throw err;
    }
  }

  /** TransferPulse sistem kullanıcısını sağlar (yoksa oluşturur), id'yi cache'ler. */
  private async getSystemUserId(): Promise<string> {
    if (this.systemUserId) {
      return this.systemUserId;
    }
    const user = await this.prisma.user.upsert({
      where: { username: SYSTEM_USERNAME },
      update: {},
      create: {
        username: SYSTEM_USERNAME,
        email: SYSTEM_EMAIL,
        // Login yok: rastgele, kimsenin bilmediği hash (eşleşmez).
        passwordHash: crypto.randomBytes(32).toString('hex'),
        nickname: 'TransferPulse',
        role: 'User',
        status: 'Active',
        isMailConfirm: true,
      },
      select: { id: true },
    });
    this.systemUserId = user.id;
    return user.id;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002'
    );
  }
}
