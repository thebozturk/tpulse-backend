import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

/** docs/03 UserDto. Hassas alan (passwordHash) YOK. Auth + Users ortak kullanır. */
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() username: string;
  @ApiProperty() email: string;
  @ApiProperty() nickname: string;
  @ApiPropertyOptional() profilePic?: string;
  @ApiProperty() isMailConfirm: boolean;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiPropertyOptional() favouriteTeam?: string;
  @ApiProperty() reputationScore: number;
  @ApiProperty() role: string;
  @ApiProperty() createdAt: Date;
}
