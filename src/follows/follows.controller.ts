import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { ListResponse } from '../common/interfaces/response.interface';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import {
  FollowActionResultDto,
  FollowingListResponseDto,
} from './dto/follow-response.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@ApiBearerAuth()
@Controller('api')
@Throttle(ThrottlePolicies.write)
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post('users/:id/follow')
  @ApiOperation({ summary: 'Kullanıcıyı takip et (201 / 200 unchanged / 404)' })
  @ApiResponse({ status: 201, type: FollowActionResultDto })
  @ApiResponse({ status: 200, type: FollowActionResultDto })
  @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
  async follow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FollowActionResultDto> {
    const outcome = await this.follows.follow(user.userId, id);
    if (outcome === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.CREATED);
    return { success: true };
  }

  @Delete('users/:id/follow')
  @ApiOperation({ summary: 'Takibi bırak (200) / zaten takip etmiyor (200)' })
  @ApiResponse({ status: 200, type: FollowActionResultDto })
  async unfollow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FollowActionResultDto> {
    const outcome = await this.follows.unfollow(user.userId, id);
    return outcome === 'unfollowed' ? { success: true } : { unchanged: true };
  }

  @Get('me/following')
  @ApiOperation({ summary: 'Takip ettiğim kullanıcıların id listesi' })
  @ApiResponse({ status: 200, type: FollowingListResponseDto })
  async following(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<string>> {
    return { items: await this.follows.getFollowingIds(user.userId) };
  }
}
