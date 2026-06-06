import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum UserContentType {
  Posts = 'posts',
  Comments = 'comments',
  Transfers = 'transfers',
}

export class AdminUserContentQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: UserContentType, example: UserContentType.Posts })
  @IsEnum(UserContentType)
  type: UserContentType;
}
