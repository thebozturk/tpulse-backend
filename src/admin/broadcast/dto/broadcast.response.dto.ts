import { ApiProperty } from '@nestjs/swagger';

export class BroadcastResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiProperty({ example: 'all' }) target: string;
  @ApiProperty({
    example: 'Queued',
    enum: ['Queued', 'Sending', 'Done', 'Failed'],
  })
  status: string;
  @ApiProperty({ example: 0 }) sentCount: number;
  @ApiProperty({ format: 'uuid' }) createdBy: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
