import { ApiProperty } from '@nestjs/swagger';

/** `POST /admin/players` 201 dönüşü. */
export class PlayerIdResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  playerId: string;
}
