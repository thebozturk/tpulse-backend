import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TransferFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toTeamId?: string;

  @ApiPropertyOptional({
    description: 'Takım filtresi — gelen VEYA giden (iki taraftan biri)',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({
    description: 'Lig filtresi — kaynak VEYA hedef takımın ligi',
  })
  @IsOptional()
  @IsUUID()
  leagueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeMin?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
  @ApiPropertyOptional({
    description: 'field veya -field (createdAt/transferDate/feeAmount)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sort?: string;
}

export class RumourFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) sort?: string;
}

export class BetweenTeamsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() fromTeamId: string;
  @ApiPropertyOptional() @IsUUID() toTeamId: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeReverse: boolean = false;
}

export class LatestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 10;
}

export class TopExpensiveDto extends LatestQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

export class LeagueTransferFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) sort?: string;
}

export class LatestByLeaguesDto {
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take: number = 5;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}
