import { ApiProperty } from '@nestjs/swagger';

export class SeedResultDto {
  @ApiProperty() leaguesInserted: number;
  @ApiProperty() leaguesUpdated: number;
  @ApiProperty() teamsInserted: number;
  @ApiProperty() teamsUpdated: number;
  @ApiProperty() playersInserted: number;
  @ApiProperty() playersUpdated: number;
  @ApiProperty() positionsCreated: number;
}

export class SyncRunDto {
  @ApiProperty() id: string;
  @ApiProperty() startedAt: Date;
  @ApiProperty() completedAt: Date;
  @ApiProperty() durationMs: number;
  @ApiProperty() status: number;
  @ApiProperty() leaguesProcessed: number;
  @ApiProperty() teamsInserted: number;
  @ApiProperty() teamsUpdated: number;
  @ApiProperty() playersInserted: number;
  @ApiProperty() playersUpdated: number;
  @ApiProperty() transfersCreated: number;
  @ApiProperty() playersMarkedFree: number;
  @ApiProperty() errorCount: number;
}
