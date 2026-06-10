import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, VerificationType } from '@prisma/client';

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
  @ApiPropertyOptional({
    enum: VerificationType,
    nullable: true,
    description: 'Doğrulama rozeti: Blue=onaylı kullanıcı, Gold=onaylı marka',
  })
  verificationType: VerificationType | null;
  @ApiProperty() createdAt: Date;
}
