import { ApiProperty } from '@nestjs/swagger';

/** `POST /admin/teams` yanıtı — oluşturulan takımın id'si. */
export class TeamIdResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  teamId: string;
}
