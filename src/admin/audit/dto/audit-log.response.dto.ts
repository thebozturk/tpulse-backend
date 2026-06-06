import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) actorUserId: string;
  @ApiProperty({ example: 'user.status' }) action: string;
  @ApiPropertyOptional({ example: 'User' }) targetType?: string;
  @ApiPropertyOptional({ format: 'uuid' }) targetId?: string;
  @ApiPropertyOptional({ type: Object, description: 'Serbest metadata (json)' })
  metadata?: unknown;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
