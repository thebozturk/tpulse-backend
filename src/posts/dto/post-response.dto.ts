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
}
