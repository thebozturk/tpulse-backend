import { ApiProperty } from '@nestjs/swagger';
import { TeamTransferLineDto } from './team-transfer-line.dto';

class LeagueBriefDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() logo: string;
}

export class LeagueTransfersDto {
  @ApiProperty({ type: LeagueBriefDto }) league: LeagueBriefDto;
  @ApiProperty({ type: [TeamTransferLineDto] })
  transfers: TeamTransferLineDto[];
}
