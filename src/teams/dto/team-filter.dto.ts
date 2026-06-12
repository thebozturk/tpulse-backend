import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TeamFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'İsim araması (aksan-duyarsız)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;
}
