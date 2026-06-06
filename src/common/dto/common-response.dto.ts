import { ApiProperty } from '@nestjs/swagger';

/** `{ success, message }` dönen yazma/aksiyon uçları için. */
export class ActionMessageResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'İşlem tamamlandı' }) message: string;
}

/** Sadece `{ success }` dönen uçlar (update/delete onayı). */
export class SuccessResponseDto {
  @ApiProperty({ example: true }) success: boolean;
}

/** Sayaç uçları: `{ count }`. */
export class CountResponseDto {
  @ApiProperty({ example: 12 }) count: number;
}
