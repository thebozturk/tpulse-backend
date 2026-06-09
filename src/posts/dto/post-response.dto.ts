import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() ownerName: string;
  @ApiPropertyOptional() ownerPhoto?: string;
  @ApiProperty() isMailConfirm: boolean;
  @ApiProperty() userRole: string;
  @ApiProperty() content: string;
  @ApiProperty() postType: number;
  @ApiPropertyOptional() playerId?: string;
  @ApiPropertyOptional() playerName?: string;
  /** Oyuncu uyruğu — /api/transfers/latest ile birebir aynı kaynak (player.nationality). */
  @ApiPropertyOptional() playerNationality?: string;
  @ApiPropertyOptional() playerPhoto?: string;
  @ApiPropertyOptional() teamId?: string;
  @ApiPropertyOptional() teamName?: string;
  @ApiPropertyOptional() teamLogo?: string;
  @ApiPropertyOptional() fromTeamId?: string;
  @ApiPropertyOptional() fromTeamName?: string;
  @ApiPropertyOptional() fromTeamLogo?: string;
  @ApiPropertyOptional() toTeamId?: string;
  @ApiPropertyOptional() toTeamName?: string;
  @ApiPropertyOptional() toTeamLogo?: string;
  @ApiProperty() likeCount: number;
  @ApiProperty() isLiked: boolean;
  @ApiProperty() isVotingEnabled: boolean;
  @ApiProperty() agreeCount: number;
  @ApiProperty() disagreeCount: number;
  @ApiProperty() totalVotes: number;
  @ApiProperty() agreePercentage: number;
  @ApiProperty() disagreePercentage: number;
  @ApiPropertyOptional() userVote?: number;
  @ApiProperty() createdAtUtc: Date;
  @ApiProperty() commentCount: number;
  @ApiPropertyOptional({
    description:
      'Bot içeriği kategorisi (1=duyum, 2=son dakika, 3=resmi); normal postta null',
  })
  category?: number;
  @ApiPropertyOptional({ description: 'Bot içeriği görseli' })
  imageUrl?: string;
  @ApiPropertyOptional({ description: 'Kaynak (tweet) URL' })
  sourceUrl?: string;
}
