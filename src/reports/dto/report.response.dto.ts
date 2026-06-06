import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason, ReportStatus, ReportTargetType } from '@prisma/client';

export class ReportResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) reporterUserId: string;
  @ApiProperty({ enum: ReportTargetType }) targetType: ReportTargetType;
  @ApiProperty({ format: 'uuid' }) targetId: string;
  @ApiProperty({ enum: ReportReason }) reason: ReportReason;
  @ApiPropertyOptional() note?: string;
  @ApiProperty({ enum: ReportStatus }) status: ReportStatus;
  @ApiPropertyOptional({ format: 'uuid' }) reviewedByUserId?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) reviewedAt?: Date;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
