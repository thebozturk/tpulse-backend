import { ApiProperty } from '@nestjs/swagger';
import { NewsResponseDto } from '../../news/dto/news-response.dto';
import { PostResponseDto } from '../../posts/dto/post-response.dto';
import { TeamTransferLineDto } from '../../transfers/dto/team-transfer-line.dto';
import { PlayerResponseDto } from './player-response.dto';

export class PlayerProfileDto {
  @ApiProperty({ type: PlayerResponseDto }) player: PlayerResponseDto;
  @ApiProperty({ type: [TeamTransferLineDto] })
  transfers: TeamTransferLineDto[];
  @ApiProperty({ type: [NewsResponseDto] }) news: NewsResponseDto[];
  @ApiProperty({ type: [PostResponseDto] }) posts: PostResponseDto[];
}
