import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlayerStatisticDto } from './player-statistic.dto';

export class PlayerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe ad (admin panel için)' })
  firstNameTr?: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe soyad (admin panel için)' })
  lastNameTr?: string;
  @ApiProperty() fullName: string;
  @ApiProperty() nationality: string;
  @ApiPropertyOptional() birthDate?: Date;
  @ApiPropertyOptional() height?: number;
  @ApiPropertyOptional() weight?: number;
  @ApiPropertyOptional() photo?: string;
  @ApiPropertyOptional() birthPlace?: string;
  @ApiPropertyOptional() birthCountry?: string;
  @ApiProperty() isFree: boolean;
  @ApiProperty() teamId: string;
  @ApiProperty() teamName: string;
  @ApiPropertyOptional() teamLogo?: string;
  @ApiPropertyOptional() positionId?: string;
  @ApiPropertyOptional() positionName?: string;
  @ApiPropertyOptional({
    type: [PlayerStatisticDto],
    description: 'Lig × sezon istatistikleri — yalnız tekil futbolcu GET’inde',
  })
  statistics?: PlayerStatisticDto[];
}
