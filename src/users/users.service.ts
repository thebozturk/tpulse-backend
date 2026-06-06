import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { toUserResponse } from './user.mapper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
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
}
