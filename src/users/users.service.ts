import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { UserStatusCache } from '../common/auth/user-status.cache';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { AdminUpdateReputationDto } from './dto/admin-update-reputation.dto';
import { AdminUpdateRoleDto } from './dto/admin-update-role.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminUserContentItemDto } from './dto/admin-user-content-item.dto';
import {
  AdminUserContentQueryDto,
  UserContentType,
} from './dto/admin-user-content.query.dto';
import { AdminUserDetailResponseDto } from './dto/admin-user-detail.response.dto';
import { AdminUserListQueryDto } from './dto/admin-user-list.query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { toUserDetailResponse, toUserResponse } from './user.mapper';

const ADMIN_ROLE = 'Admin';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly statusCache: UserStatusCache,
    private readonly email: EmailService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException(
        'E-posta veya kullanıcı adı zaten kullanımda',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        nickname: dto.nickname,
        profilePic: dto.profilePic,
        favouriteTeam: dto.favouriteTeam,
      },
    });
    this.logger.log(`Admin kullanıcı oluşturdu: ${user.id}`);
    return toUserResponse(user);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return toUserResponse(user);
  }

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<UserResponseDto>> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return buildPaged(items.map(toUserResponse), totalCount, page, pageSize);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    if (dto.id !== id) {
      throw new BadRequestException('Route id ile body id uyuşmuyor');
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        nickname: dto.nickname,
        profilePic: dto.profilePic,
        favouriteTeam: dto.favouriteTeam,
        updatedAt: new Date(),
      },
    });
    return toUserResponse(user);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  // ─── Back office (BO-2) ───────────────────────────────────────────────

  /** Filtreli + aranabilir kullanıcı listesi (status/role/q). */
  async adminFindAll(
    query: AdminUserListQueryDto,
  ): Promise<PagedResult<UserResponseDto>> {
    const { page, pageSize, status, role, q } = query;
    const { skip, take } = toSkipTake(page, pageSize);
    const where: Prisma.UserWhereInput = {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { nickname: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return buildPaged(items.map(toUserResponse), totalCount, page, pageSize);
  }

  /** Tekil kullanıcı detayı (moderasyon alanları dahil). */
  async getDetail(id: string): Promise<AdminUserDetailResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return toUserDetailResponse(user);
  }

  /** Kullanıcının ürettiği içerik (post/comment/transfer) — sayfalı. */
  async getContent(
    id: string,
    query: AdminUserContentQueryDto,
  ): Promise<PagedResult<AdminUserContentItemDto>> {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    const { type, page, pageSize } = query;
    const { skip, take } = toSkipTake(page, pageSize);

    if (type === UserContentType.Posts) {
      const where = { ownerId: id };
      const [rows, totalCount] = await Promise.all([
        this.prisma.post.findMany({
          where,
          skip,
          take,
          orderBy: { createdAtUtc: 'desc' },
          select: { id: true, content: true, createdAtUtc: true },
        }),
        this.prisma.post.count({ where }),
      ]);
      const items = rows.map((r) => ({
        type: 'post',
        id: r.id,
        label: r.content.slice(0, 120),
        createdAt: r.createdAtUtc,
      }));
      return buildPaged(items, totalCount, page, pageSize);
    }

    if (type === UserContentType.Comments) {
      const where = { ownerId: id };
      const [rows, totalCount] = await Promise.all([
        this.prisma.comment.findMany({
          where,
          skip,
          take,
          orderBy: { createdAtUtc: 'desc' },
          select: { id: true, content: true, createdAtUtc: true },
        }),
        this.prisma.comment.count({ where }),
      ]);
      const items = rows.map((r) => ({
        type: 'comment',
        id: r.id,
        label: (r.content ?? '').slice(0, 120),
        createdAt: r.createdAtUtc,
      }));
      return buildPaged(items, totalCount, page, pageSize);
    }

    // transfers — Transfer.createdByUserId; soft-delete'leri hariç tut.
    const where = { createdByUserId: id, isDeleted: false };
    const [rows, totalCount] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      }),
      this.prisma.transfer.count({ where }),
    ]);
    const items = rows.map((r) => ({
      type: 'transfer',
      id: r.id,
      label: '',
      createdAt: r.createdAt,
    }));
    return buildPaged(items, totalCount, page, pageSize);
  }

  /** Durum güncelle. Active dışına geçişte token'ları iptal et + cache'i tazele. */
  async updateStatus(
    id: string,
    dto: AdminUpdateUserStatusDto,
  ): Promise<AdminUserDetailResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const becomingInactive = dto.status !== UserStatus.Active;
    if (
      becomingInactive &&
      existing.role === ADMIN_ROLE &&
      existing.status === UserStatus.Active
    ) {
      await this.assertNotLastActiveAdmin();
    }

    const isBanned = dto.status === UserStatus.Banned;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status,
        bannedAt: isBanned ? new Date() : null,
        banReason: becomingInactive ? (dto.reason ?? null) : null,
        updatedAt: new Date(),
      },
    });

    if (becomingInactive) {
      await this.tokens.revokeAllForUser(id);
    }
    await this.statusCache.setStatus(id, dto.status);

    this.logger.log(`Kullanıcı durumu güncellendi: ${id} → ${dto.status}`);

    // Ban/askı bildirimi — best-effort, durum güncellemesini bloklamaz.
    if (becomingInactive) {
      const reason = dto.reason ?? 'Topluluk kurallarının ihlali.';
      try {
        if (isBanned) {
          await this.email.sendAccountBanned(user.email, {
            name: user.nickname,
            reason,
          });
        } else if (dto.status === UserStatus.Suspended) {
          await this.email.sendAccountSuspended(user.email, {
            name: user.nickname,
            reason,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Hesap durumu e-postası gönderilemedi (${id}): ${err}`,
        );
      }
    }

    return toUserDetailResponse(user);
  }

  /** Rol güncelle. Son aktif admin'i düşürmeyi engelle. */
  async updateRole(
    id: string,
    dto: AdminUpdateRoleDto,
  ): Promise<AdminUserDetailResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const downgradingAdmin =
      existing.role === ADMIN_ROLE && dto.role !== ADMIN_ROLE;
    if (downgradingAdmin && existing.status === UserStatus.Active) {
      await this.assertNotLastActiveAdmin();
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, updatedAt: new Date() },
    });
    this.logger.log(`Kullanıcı rolü güncellendi: ${id} → ${dto.role}`);
    return toUserDetailResponse(user);
  }

  /** İtibar güncelle: delta (artımlı) veya value (mutlak) — tam olarak biri. */
  async updateReputation(
    id: string,
    dto: AdminUpdateReputationDto,
  ): Promise<AdminUserDetailResponseDto> {
    const hasDelta = dto.delta !== undefined;
    const hasValue = dto.value !== undefined;
    if (hasDelta === hasValue) {
      throw new BadRequestException(
        'delta veya value alanlarından tam olarak biri gönderilmeli',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: hasDelta
        ? { reputationScore: { increment: dto.delta }, updatedAt: new Date() }
        : { reputationScore: dto.value, updatedAt: new Date() },
    });
    return toUserDetailResponse(user);
  }

  /** Sistemde başka aktif admin yoksa kritik düşürme/pasifleştirmeyi engelle. */
  private async assertNotLastActiveAdmin(): Promise<void> {
    const activeAdmins = await this.prisma.user.count({
      where: { role: ADMIN_ROLE, status: UserStatus.Active },
    });
    if (activeAdmins <= 1) {
      throw new ConflictException(
        'Son aktif admin düşürülemez veya pasifleştirilemez',
      );
    }
  }
}
