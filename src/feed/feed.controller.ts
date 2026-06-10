import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PagedResult } from '../common/interfaces/response.interface';
import { ApiPagedResponse } from '../common/swagger/api-envelope.decorators';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('api/feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('for-you')
  @ApiOperation({
    summary: 'Senin İçin — skorlanmış kişisel feed (favourite + follow)',
  })
  @ApiPagedResponse(PostResponseDto)
  forYou(
    @CurrentUser() user: AuthUser,
    @Query() query: FeedQueryDto,
  ): Promise<PagedResult<PostResponseDto>> {
    return this.feed.forYou(user.userId, query.page, query.pageSize);
  }
}
