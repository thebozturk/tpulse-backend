import { ApiProperty } from '@nestjs/swagger';

export class FollowActionResultDto {
  @ApiProperty({
    required: false,
    example: true,
    description: 'Yeni takip oluşturuldu (201) veya takip kaldırıldı.',
  })
  success?: boolean;

  @ApiProperty({
    required: false,
    example: true,
    description: 'Durum zaten istenen halde (200) — değişiklik olmadı.',
  })
  unchanged?: boolean;
}

export class FollowingListResponseDto {
  @ApiProperty({
    type: [String],
    example: ['7c9e6679-7425-40de-944b-e07fc1f90ae7'],
    description: 'Takip edilen kullanıcıların id listesi.',
  })
  items: string[];
}
