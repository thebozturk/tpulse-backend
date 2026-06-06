import { ApiProperty } from '@nestjs/swagger';

/** `SingleResponse<{ url }>` inner DTO — profil fotoğrafı URL'si. */
export class ProfilePhotoUrlDto {
  @ApiProperty({ example: 'https://cdn.example.com/photos/abc.jpg' })
  url: string;
}
