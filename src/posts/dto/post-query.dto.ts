import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PostVoteChoice } from '../../common/enums';

export class PostFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyFavourites: boolean = false;
}

export class NewCountDto {
  @ApiProperty() @IsUUID() afterPostId: string;
}

export class VotePostDto {
  @ApiProperty({ enum: PostVoteChoice })
  @IsEnum(PostVoteChoice)
  choice: PostVoteChoice;
}

export class PostVoteResultDto {
  @ApiProperty({ enum: ['Invalid', 'Unchanged', 'Applied'] })
  result: 'Invalid' | 'Unchanged' | 'Applied';
  @ApiProperty() agreeCount: number;
  @ApiProperty() disagreeCount: number;
  @ApiProperty() totalVotes: number;
  @ApiProperty() agreePercentage: number;
  @ApiProperty() disagreePercentage: number;
  @ApiPropertyOptional() userVote?: number;
}
