import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PostType } from '../../common/enums';

export class CreatePostDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiProperty({ enum: PostType })
  @IsEnum(PostType)
  postType: PostType;

  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toTeamId?: string;

  @ApiProperty({ default: false }) @IsBoolean() isVotingEnabled: boolean =
    false;
}

export class UpdatePostDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toTeamId?: string;
}
