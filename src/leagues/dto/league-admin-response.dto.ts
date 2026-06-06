import { ApiProperty } from '@nestjs/swagger';

/** `POST /api/admin/leagues` → `{ data: { leagueId } }` */
export class LeagueCreatedResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  leagueId: string;
}

/** Image upload/replace/from-url → `{ data: { url } }` */
export class LeagueImageResponseDto {
  @ApiProperty({ example: 'https://cdn.example.com/leagues/abc.png' })
  url: string;
}
