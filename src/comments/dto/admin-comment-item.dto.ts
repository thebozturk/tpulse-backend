import { ApiProperty } from '@nestjs/swagger';

/** Moderasyon listesi için düz yorum gösterimi (ağaç değil). */
export class AdminCommentItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) postId: string;
  @ApiProperty({ format: 'uuid' }) ownerId: string;
  @ApiProperty() ownerUsername: string;
  @ApiProperty() content: string;
  @ApiProperty() likeCount: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
