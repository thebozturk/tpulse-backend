import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** BullMQ job kuyruğa alındığında dönen response. */
export class SyncJobResponseDto {
  @ApiProperty({ example: '42', description: 'BullMQ job ID' })
  jobId: string;

  @ApiPropertyOptional({
    example: 7009,
    description: 'Sadece tek-lig sync isteğinde dolu',
  })
  leagueExternalId?: number;
}
