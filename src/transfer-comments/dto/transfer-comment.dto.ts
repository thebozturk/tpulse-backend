import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Senkron create dönüşü: yeni yorumun id'si. */
export class TransferCommentCreatedDto {
  @ApiProperty() commentId: string;
}

export class TransferCommentDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() ownerName: string;
  @ApiPropertyOptional() ownerPhoto?: string;
  @ApiPropertyOptional() content?: string;
  @ApiProperty() transferId: string;
  @ApiPropertyOptional() parentId?: string;
  @ApiProperty() likeCount: number;
  @ApiProperty() isLiked: boolean;
  @ApiProperty() createdAtUtc: Date;
  @ApiProperty({ type: [TransferCommentDto] }) replies: TransferCommentDto[];
}

export class CreateTransferCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateTransferCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content: string;
}
