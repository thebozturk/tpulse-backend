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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Response } from 'express';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { CreatePostDto, UpdatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import {
  NewCountDto,
  PostFilterDto,
  PostVoteResultDto,
  VotePostDto,
} from './dto/post-query.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('api/posts')
@Throttle(ThrottlePolicies.write)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('new-count')
  @Public()
  @ApiOperation({ summary: 'afterPostId sonrası yeni gönderi sayısı' })
  async newCount(@Query() query: NewCountDto): Promise<{ count: number }> {
    return { count: await this.posts.newCount(query.afterPostId) };
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kendi gönderilerim' })
  async my(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<PostResponseDto>> {
    return { items: await this.posts.my(user.userId) };
  }

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Feed (filtre + like-state)' })
  feed(
    @Query() filter: PostFilterDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<PagedResult<PostResponseDto>> {
    return this.posts.feed(filter, user);
  }

  @Get('by-player/:playerId')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Oyuncuya göre gönderiler' })
  async byPlayer(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<ListResponse<PostResponseDto>> {
    return { items: await this.posts.byPlayer(playerId, user) };
  }

  @Get('by-team/:teamId')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Takıma göre gönderiler' })
  async byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<ListResponse<PostResponseDto>> {
    return { items: await this.posts.byTeam(teamId, user) };
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Gönderiyi getir' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<SingleResponse<PostResponseDto>> {
    return { data: await this.posts.findById(id, user) };
  }

  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Gönderi oluştur (async 202)' })
  async create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.posts.createAsync(dto, user.userId);
    return { success: true, message: 'Gönderi işleme alındı' };
  }

  @Post(':id/vote')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Oy ver (senkron)' })
  async vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VotePostDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<PostVoteResultDto>> {
    return { data: await this.posts.vote(id, user.userId, dto.choice) };
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gönderi güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.posts.update(id, user.userId, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gönderi sil' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.posts.remove(id, user.userId);
    return { success: true };
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Beğen (202) / zaten beğenili (200)' })
  like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ unchanged?: boolean; queued?: boolean }> {
    return this.reaction(id, user.userId, true, res);
  }

  @Delete(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Beğeniyi kaldır (202) / zaten değil (200)' })
  unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ unchanged?: boolean; queued?: boolean }> {
    return this.reaction(id, user.userId, false, res);
  }

  private async reaction(
    id: string,
    userId: string,
    isLike: boolean,
    res: Response,
  ): Promise<{ unchanged?: boolean; queued?: boolean }> {
    const outcome = await this.posts.react(id, userId, isLike);
    if (outcome === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.ACCEPTED);
    return { queued: true };
  }
}
