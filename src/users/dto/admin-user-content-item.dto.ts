import { ApiProperty } from '@nestjs/swagger';

/** Kullanıcının ürettiği içeriğin sade gösterimi (post/comment/transfer ortak). */
export class AdminUserContentItemDto {
  @ApiProperty({ example: 'post', enum: ['post', 'comment', 'transfer'] })
  type: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: 'İçerik özeti',
    description: 'Metinsel içeriğin kısa özeti (transferde boş olabilir)',
  })
  label: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
