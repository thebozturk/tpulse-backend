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
import {
  ListResponse,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  CreateTransferCommentDto,
  TransferCommentDto,
  UpdateTransferCommentDto,
} from './dto/transfer-comment.dto';
import { TransferCommentsService } from './transfer-comments.service';

@ApiTags('transfer-comments')
@Controller('api')
@Throttle(ThrottlePolicies.write)
export class TransferCommentController {
  constructor(private readonly comments: TransferCommentsService) {}

  @Get('transfers/:transferId/comments')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Transfer yorumları (2-seviye, like-state)' })
  async list(
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<ListResponse<TransferCommentDto>> {
    return { items: await this.comments.getByTransfer(transferId, user) };
  }

  @Post('transfers/:transferId/comments')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transfer yorumu ekle (senkron 201)' })
  async create(
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: CreateTransferCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<{ commentId: string }>> {
    const { id } = await this.comments.create(transferId, user.userId, dto);
    return { data: { commentId: id } };
  }

  @Put('transfer-comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transfer yorumu güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.update(id, user.userId, dto.content);
    return { success: true };
  }

  @Delete('transfer-comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transfer yorumu sil' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.remove(id, user.userId);
    return { success: true };
  }

  @Post('transfer-comments/:id/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer yorumunu beğen (senkron 200)' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.react(id, user.userId, true);
    return { success: true };
  }

  @Delete('transfer-comments/:id/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer yorumu beğenisini kaldır (senkron 200)' })
  async unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.comments.react(id, user.userId, false);
    return { success: true };
  }
}
