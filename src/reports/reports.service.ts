import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Report,
  ReportStatus,
  ReportTargetType,
  UserStatus,
} from '@prisma/client';
import { CommentsService } from '../comments/comments.service';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { TransferCommentsService } from '../transfer-comments/transfer-comments.service';
import { UsersService } from '../users/users.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportListQueryDto } from './dto/report-list.query.dto';
import { ReportResponseDto } from './dto/report.response.dto';
import { ReviewReportDto } from './dto/review-report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly transferComments: TransferCommentsService,
  ) {}

  /** Kullanıcı rapor oluşturur. Aynı hedefe tekrar rapor engellenir (unique). */
  async create(
    reporterUserId: string,
    dto: CreateReportDto,
  ): Promise<ReportResponseDto> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const duplicate = await this.prisma.report.findUnique({
      where: {
        reporterUserId_targetType_targetId: {
          reporterUserId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (duplicate) {
      throw new ConflictException('Bu içeriği zaten raporladınız');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        note: dto.note,
      },
    });
    this.logger.log(
      `Rapor oluşturuldu: ${report.id} (${dto.targetType}/${dto.targetId})`,
    );
    return toReportResponse(report);
  }

  /** Admin moderasyon kuyruğu (status filtreli, sayfalı). */
  async list(
    query: ReportListQueryDto,
  ): Promise<PagedResult<ReportResponseDto>> {
    const { page, pageSize, status } = query;
    const { skip, take } = toSkipTake(page, pageSize);
    const where = status ? { status } : {};
    const [items, totalCount] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);
    return buildPaged(items.map(toReportResponse), totalCount, page, pageSize);
  }

  /**
   * Raporu incele/aksiyon al. status=Actioned ise opsiyonel yan etkiler
   * (deleteContent / banUser) önce uygulanır; başarılıysa rapor güncellenir
   * (aksiyon başarısızsa rapor Pending kalır — yanlış "Actioned" yazılmaz).
   */
  async review(
    id: string,
    reviewerUserId: string,
    dto: ReviewReportDto,
  ): Promise<ReportResponseDto> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Rapor bulunamadı');
    }

    if (dto.status === ReportStatus.Actioned) {
      if (dto.deleteContent) {
        await this.deleteTarget(report.targetType, report.targetId);
      }
      if (dto.banUser) {
        await this.banTargetUser(
          report.targetType,
          report.targetId,
          report.note ?? undefined,
        );
      }
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
    this.logger.log(`Rapor incelendi: ${id} → ${dto.status}`);
    return toReportResponse(updated);
  }

  private async assertTargetExists(
    type: ReportTargetType,
    id: string,
  ): Promise<void> {
    const exists = await this.targetExists(type, id);
    if (!exists) {
      throw new NotFoundException('Raporlanan içerik bulunamadı');
    }
  }

  private async targetExists(
    type: ReportTargetType,
    id: string,
  ): Promise<boolean> {
    switch (type) {
      case ReportTargetType.Post:
        return (await this.prisma.post.count({ where: { id } })) > 0;
      case ReportTargetType.Comment:
        return (await this.prisma.comment.count({ where: { id } })) > 0;
      case ReportTargetType.TransferComment:
        return (await this.prisma.transferComment.count({ where: { id } })) > 0;
      case ReportTargetType.User:
        return (await this.prisma.user.count({ where: { id } })) > 0;
    }
  }

  private async deleteTarget(
    type: ReportTargetType,
    id: string,
  ): Promise<void> {
    switch (type) {
      case ReportTargetType.Post:
        return this.posts.adminRemove(id);
      case ReportTargetType.Comment:
        return this.comments.adminRemove(id);
      case ReportTargetType.TransferComment:
        return this.transferComments.adminRemove(id);
      case ReportTargetType.User:
        throw new BadRequestException(
          'Kullanıcı hedefli raporda deleteContent kullanılamaz',
        );
    }
  }

  /** Hedef kullanıcıyı (User hedefi ise kendisi, içerik ise sahibi) banlar. */
  private async banTargetUser(
    type: ReportTargetType,
    id: string,
    reason?: string,
  ): Promise<void> {
    const userId =
      type === ReportTargetType.User ? id : await this.resolveOwner(type, id);
    if (!userId) {
      throw new NotFoundException('Banlanacak kullanıcı bulunamadı');
    }
    await this.users.updateStatus(userId, {
      status: UserStatus.Banned,
      reason,
    });
  }

  private async resolveOwner(
    type: ReportTargetType,
    id: string,
  ): Promise<string | null> {
    switch (type) {
      case ReportTargetType.Post: {
        const p = await this.prisma.post.findUnique({
          where: { id },
          select: { ownerId: true },
        });
        return p?.ownerId ?? null;
      }
      case ReportTargetType.Comment: {
        const c = await this.prisma.comment.findUnique({
          where: { id },
          select: { ownerId: true },
        });
        return c?.ownerId ?? null;
      }
      case ReportTargetType.TransferComment: {
        const t = await this.prisma.transferComment.findUnique({
          where: { id },
          select: { ownerId: true },
        });
        return t?.ownerId ?? null;
      }
      case ReportTargetType.User:
        return id;
    }
  }
}

function toReportResponse(report: Report): ReportResponseDto {
  return {
    id: report.id,
    reporterUserId: report.reporterUserId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    note: report.note ?? undefined,
    status: report.status,
    reviewedByUserId: report.reviewedByUserId ?? undefined,
    reviewedAt: report.reviewedAt ?? undefined,
    createdAt: report.createdAt,
  };
}
