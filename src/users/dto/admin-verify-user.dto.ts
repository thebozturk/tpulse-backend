import { ApiProperty } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';
import { IsEnum, ValidateIf } from 'class-validator';

/** Doğrulama rozeti (tik) güncelleme — yalnızca Admin. */
export class AdminVerifyUserDto {
  @ApiProperty({
    enum: VerificationType,
    nullable: true,
    example: VerificationType.Blue,
    description:
      'Blue = onaylı kullanıcı (mavi tik), Gold = onaylı marka/resmi (sarı tik), null = tiki kaldır',
  })
  @ValidateIf((o) => o.verificationType !== null)
  @IsEnum(VerificationType)
  verificationType: VerificationType | null;
}
