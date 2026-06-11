import { ApiProperty } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BlockActionResultDto {
  @ApiProperty({ required: false, example: true })
  success?: boolean;

  @ApiProperty({ required: false, example: true })
  unchanged?: boolean;
}

export class BlockedMutedUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'transfermarkt' }) username: string;
  @ApiProperty({ example: 'Transfer Haber' }) nickname: string;
  @ApiProperty({
    nullable: true,
    example: 'https://cdn.example/avatars/x.webp',
  })
  profilePic: string | null;
  @ApiProperty({ enum: VerificationType, nullable: true })
  verificationType: VerificationType | null;
}

export class AddMutedKeywordDto {
  @ApiProperty({
    example: 'sponsorlu',
    minLength: 2,
    maxLength: 100,
    description:
      "Bu kelimeyi içeren postlar feed'de gizlenir (case-insensitive).",
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword: string;
}

export class MutedKeywordDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'sponsorlu' }) keyword: string;
}
