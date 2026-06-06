import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Tek bir health indicator'ın detay objesi. */
export class HealthIndicatorResultDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status: 'up' | 'down';
}

/** @nestjs/terminus HealthCheckResult şeması. */
export class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'error', 'shutting_down'],
    description: 'Genel sistem durumu',
  })
  status: 'ok' | 'error' | 'shutting_down';

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'Sağlıklı indicator\'ların detayları',
  })
  info?: Record<string, HealthIndicatorResultDto>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'Hatalı indicator\'ların detayları',
  })
  error?: Record<string, HealthIndicatorResultDto>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'Tüm indicator\'ların detayları',
  })
  details: Record<string, HealthIndicatorResultDto>;
}
