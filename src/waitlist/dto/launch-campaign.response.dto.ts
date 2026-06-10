import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LaunchCampaignResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() subject: string;
  @ApiProperty() body: string;
  @ApiPropertyOptional() ctaLabel?: string;
  @ApiPropertyOptional() ctaUrl?: string;
  @ApiProperty({
    example: 'Queued',
    enum: ['Queued', 'Sending', 'Done', 'Failed'],
  })
  status: string;
  @ApiProperty({ example: 0, description: 'Hedef abone sayısı' })
  total: number;
  @ApiProperty({ example: 0, description: 'Gönderilen e-posta sayısı' })
  sentCount: number;
  @ApiProperty({ format: 'uuid' }) createdBy: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
