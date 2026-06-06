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
import { AuditAction } from '../common/audit/audit-actions';
import { Audit } from '../common/audit/audit.decorator';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ModerationListQueryDto } from '../common/dto/moderation-list.query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PagedResult } from '../common/interfaces/response.interface';
import { ApiPagedResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { PostResponseDto } from './dto/post-response.dto';
import { PostsService } from './posts.service';

@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('api/admin/posts')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'Gönderileri listele (moderasyon, paged)' })
  @ApiPagedResponse(PostResponseDto)
  list(
    @Query() query: ModerationListQueryDto,
  ): Promise<PagedResult<PostResponseDto>> {
    return this.posts.adminList(query);
  }

  @Delete(':id')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.PostDelete, 'Post')
  @ApiOperation({ summary: 'Gönderi sil (admin, owner-bypass)' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404 })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.posts.adminRemove(id);
    return { success: true };
  }
}
