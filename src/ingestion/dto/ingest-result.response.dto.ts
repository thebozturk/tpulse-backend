import { ApiProperty } from '@nestjs/swagger';

export class IngestResultDto {
  @ApiProperty({ format: 'uuid' }) id: string;

  @ApiProperty({
    enum: ['created', 'duplicate'],
    description: "'duplicate' → aynı sourceId daha önce alınmış (idempotent)",
  })
  status: 'created' | 'duplicate';
}
