import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const BROADCAST_TARGETS = ['all'] as const;
export type BroadcastTarget = (typeof BROADCAST_TARGETS)[number];

export class CreateBroadcastDto {
  @ApiProperty({ maxLength: 200, example: 'Bakım duyurusu' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    maxLength: 500,
    example: 'Sistem bu gece 02:00-03:00 bakımda.',
  })
  @IsString()
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional({ enum: BROADCAST_TARGETS, default: 'all' })
  @IsOptional()
  @IsIn(BROADCAST_TARGETS)
  target?: BroadcastTarget;
}
