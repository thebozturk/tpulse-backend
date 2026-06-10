import { User } from '@prisma/client';
import { AdminUserDetailResponseDto } from './dto/admin-user-detail.response.dto';
import { UserResponseDto } from './dto/user-response.dto';

/** Prisma User → UserResponseDto (hassas alanları düşürür). */
export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    profilePic: user.profilePic ?? undefined,
    isMailConfirm: user.isMailConfirm,
    status: user.status,
    favouriteTeam: user.favouriteTeam ?? undefined,
    reputationScore: user.reputationScore,
    role: user.role,
    verificationType: user.verificationType,
    createdAt: user.createdAt,
  };
}

/** Prisma User → AdminUserDetailResponseDto (moderasyon alanları dahil). */
export function toUserDetailResponse(user: User): AdminUserDetailResponseDto {
  return {
    ...toUserResponse(user),
    bannedAt: user.bannedAt ?? undefined,
    banReason: user.banReason ?? undefined,
    updatedAt: user.updatedAt ?? undefined,
    verifiedAt: user.verifiedAt ?? undefined,
  };
}
