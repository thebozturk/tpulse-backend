import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
import { ListResponse } from '../common/interfaces/response.interface';
import { CommentsService } from './comments.service';
import {
  CommentDto,
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/comment.dto';

@ApiTags('comments')
@Controller('api')
@Throttle(ThrottlePolicies.write)
export class CommentController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:postId/comments')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Gönderi yorumları (2-seviye, like-state)' })
  async list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<ListResponse<CommentDto>> {
    return { items: await this.comments.getByPost(postId, user) };
  }

  @Post('posts/:postId/comments')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Yorum ekle (async 202)' })
  async create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.comments.createAsync(postId, user.userId, dto);
    return { success: true, message: 'Yorum işleme alındı' };
  }

  @Put('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yorum güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.update(id, user.userId, dto.content);
    return { success: true };
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yorum sil' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.remove(id, user.userId);
    return { success: true };
  }

  @Post('comments/:id/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Yorumu beğen (async 202)' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.reactAsync(id, user.userId, true);
    return { success: true };
  }

  @Delete('comments/:id/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Yorum beğenisini kaldır (async 202)' })
  async unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.reactAsync(id, user.userId, false);
    return { success: true };
  }
}
