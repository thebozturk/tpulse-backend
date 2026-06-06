import { ApiProperty } from '@nestjs/swagger';

/** Image upload/replace/from-url uçlarının 200 dönüşü. */
export class ImageUploadResponseDto {
  @ApiProperty({ example: 'https://cdn.example.com/players/uuid.jpg' })
  url: string;
}
