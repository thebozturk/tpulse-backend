import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.Banned })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Irkçı içerik paylaşımı',
    description: 'Banned/Suspended için gerekçe (banReason olarak saklanır)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
