import { ApiProperty } from '@nestjs/swagger';

export class WaitlistStatsResponseDto {
  @ApiProperty({ example: 1250, description: 'Toplam kayıt' })
  total: number;
  @ApiProperty({ example: 1180, description: 'Aktif abone (subscribed)' })
  subscribed: number;
  @ApiProperty({ example: 70, description: 'Abonelikten çıkan' })
  unsubscribed: number;
  @ApiProperty({ example: 900, description: 'Lansman maili gönderilmiş abone' })
  launchSent: number;
}
