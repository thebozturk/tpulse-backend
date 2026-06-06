import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlayerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
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
}
