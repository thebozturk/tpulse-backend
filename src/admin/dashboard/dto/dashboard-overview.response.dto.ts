import { ApiProperty } from '@nestjs/swagger';

export class DashboardUsersDto {
  @ApiProperty({ example: 1240, description: 'Toplam kullanıcı sayısı' })
  total: number;

  @ApiProperty({
    example: 87,
    description:
      'Bugün içerik (post/yorum) üreten benzersiz kullanıcı sayısı (aktiflik proxy)',
  })
  activeToday: number;

  @ApiProperty({ example: 53, description: 'Son 7 günde kaydolan kullanıcı' })
  newThisWeek: number;
}

export class DashboardContentDto {
  @ApiProperty({ example: 320, description: 'Onaylı transfer (rumour hariç)' })
  transfers: number;

  @ApiProperty({ example: 145, description: 'Duyum (rumour) sayısı' })
  rumours: number;

  @ApiProperty({ example: 76, description: 'Haber sayısı' })
  news: number;

  @ApiProperty({ example: 5021, description: 'Gönderi sayısı' })
  posts: number;

  @ApiProperty({ example: 18342, description: 'Yorum sayısı' })
  comments: number;
}

export class DashboardModerationDto {
  @ApiProperty({
    example: 0,
    description: 'Bekleyen şikayet sayısı (BO-3 ile dolacak)',
  })
  pendingReports: number;
}

export class DashboardRecentActivityDto {
  @ApiProperty({ example: 'post', description: 'Aktivite tipi' })
  type: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Yeni transfer hakkında ne düşünüyorsunuz?' })
  label: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class DashboardOverviewResponseDto {
  @ApiProperty({ type: DashboardUsersDto })
  users: DashboardUsersDto;

  @ApiProperty({ type: DashboardContentDto })
  content: DashboardContentDto;

  @ApiProperty({ type: DashboardModerationDto })
  moderation: DashboardModerationDto;

  @ApiProperty({ type: [DashboardRecentActivityDto] })
  recent: DashboardRecentActivityDto[];
}
