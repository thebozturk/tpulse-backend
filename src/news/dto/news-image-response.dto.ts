import { ApiProperty } from '@nestjs/swagger';

/** POST|PUT /admin/news/:newsId/image → { data: { url } } */
export class NewsImageUrlResponseDto {
  @ApiProperty({
    example: 'https://cdn.example.com/news/abc.jpg',
    description: 'Yuklenen gorselin URL-si',
  })
  url: string;
}
