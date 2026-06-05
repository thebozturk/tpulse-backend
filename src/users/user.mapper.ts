import { User } from '@prisma/client';
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
    createdAt: user.createdAt,
  };
}
