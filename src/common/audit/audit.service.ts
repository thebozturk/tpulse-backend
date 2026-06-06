import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PagedResult } from '../interfaces/response.interface';
import { buildPaged, toSkipTake } from '../pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType } from './audit-actions';

export interface AuditEntry {
  actorUserId: string;
  action: AuditActionType;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditListFilter {
  actor?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Audit kaydı yaz. Asla throw etmez — hata sadece warn'lanır (asıl işlemi bloklamaz). */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit yazılamadı (${entry.action}): ${String(err)}`);
    }
  }

  async list(filter: AuditListFilter): Promise<PagedResult<AuditLogView>> {
    const { page, pageSize } = filter;
    const { skip, take } = toSkipTake(page, pageSize);
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.actor ? { actorUserId: filter.actor } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [items, totalCount] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return buildPaged(items.map(toAuditView), totalCount, page, pageSize);
  }
}

export interface AuditLogView {
  id: string;
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
  createdAt: Date;
}

function toAuditView(row: {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
}): AuditLogView {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetType: row.targetType ?? undefined,
    targetId: row.targetId ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt,
  };
}
