import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CommentDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() ownerName: string;
  @ApiPropertyOptional() ownerPhoto?: string;
  @ApiPropertyOptional() content?: string;
  @ApiProperty() postId: string;
  @ApiPropertyOptional() parentId?: string;
  @ApiProperty() likeCount: number;
  @ApiProperty() isLiked: boolean;
  @ApiProperty() createdAtUtc: Date;
  @ApiProperty({ type: [CommentDto] }) replies: CommentDto[];
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content: string;
}
