import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditAction } from '../common/audit/audit-actions';
import { AuditService } from '../common/audit/audit.service';
import { BOT_CATEGORY_BY_KEY } from '../common/enums/bot-content-category.enum';
import { PrismaService } from '../common/prisma/prisma.service';
import { IngestPostDto } from './dto/ingest-post.dto';
import { IngestResultDto } from './dto/ingest-result.response.dto';
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
    const shape = resolvePostShape(dto);

    try {
      const post = await this.prisma.post.create({
        data: {
          ownerId,
          content: dto.text,
          postType: shape.postType,
          category: BOT_CATEGORY_BY_KEY[dto.category],
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

      await this.audit.log({
        actorUserId: ownerId,
        action: AuditAction.BotIngest,
        targetType: 'Post',
        targetId: post.id,
        metadata: { sourceId: dto.sourceId, category: dto.category },
      });

      this.logger.log(`Bot içeriği eklendi: ${post.id} (${dto.sourceId})`);
      return { id: post.id, status: 'created' };
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
