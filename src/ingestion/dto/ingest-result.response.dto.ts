import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectionTarget } from '../projection-target.resolver';

export class IngestResultDto {
  @ApiProperty({ format: 'uuid' }) id: string;

  @ApiProperty({
    enum: ['created', 'duplicate'],
    description: "'duplicate' → aynı sourceId daha önce alınmış (idempotent)",
  })
  status: 'created' | 'duplicate';

  @ApiPropertyOptional({
    enum: ['rumour', 'transfer', 'news', 'none'],
    description: 'Akış dışında yansıdığı sekme (created ise)',
  })
  projectedAs?: ProjectionTarget;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Oluşan/güncellenen Transfer/Duyum id (rumour|transfer ise)',
  })
  transferId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Oluşan Haber id (news ise)',
  })
  newsId?: string;
}
