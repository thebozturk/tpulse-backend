import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TeamWriteDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Türkçe gösterim adı (boşsa İngilizce `name` gösterilir)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nameTr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty()
  @IsUUID()
  leagueId: string;
}
