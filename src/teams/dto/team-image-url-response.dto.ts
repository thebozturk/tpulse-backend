import { ApiProperty } from '@nestjs/swagger';

/** Image upload/replace/from-url uçları — dönen S3 URL'i. */
export class TeamImageUrlResponseDto {
  @ApiProperty({ example: 'https://bucket.s3.amazonaws.com/teams/uuid.png' })
  url: string;
}
