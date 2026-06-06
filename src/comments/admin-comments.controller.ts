import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ModerationListQueryDto } from '../common/dto/moderation-list.query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PagedResult } from '../common/interfaces/response.interface';
import { ApiPagedResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { CommentsService } from './comments.service';
import { AdminCommentItemDto } from './dto/admin-comment-item.dto';

@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('api/admin/comments')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Yorumları listele (moderasyon, paged)' })
  @ApiPagedResponse(AdminCommentItemDto)
  list(
    @Query() query: ModerationListQueryDto,
  ): Promise<PagedResult<AdminCommentItemDto>> {
    return this.comments.adminList(query);
  }

  @Delete(':id')
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'Yorum sil (admin, owner-bypass)' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404 })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.comments.adminRemove(id);
    return { success: true };
  }
}
