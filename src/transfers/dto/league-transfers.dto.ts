import { ApiProperty } from '@nestjs/swagger';
import { TeamTransferLineDto } from './team-transfer-line.dto';

class LeagueBriefDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() logo: string;
}

export class LeagueTransfersDto {
  @ApiProperty({ type: LeagueBriefDto }) league: LeagueBriefDto;

  // Flat alanlar — mobil (transfer_latest_by_leagues_dto.dart) lig bilgisini
  // nested 'league' yerine flat leagueId/leagueName/leagueLogo bekliyor.
  // Nested 'league' backoffice/contract için korunuyor (non-breaking).
  @ApiProperty() leagueId: string;
  @ApiProperty() leagueName: string;
  @ApiProperty() leagueLogo: string;

  @ApiProperty({ type: [TeamTransferLineDto] })
  transfers: TeamTransferLineDto[];
}
