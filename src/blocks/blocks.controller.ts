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
import { BlocksService } from './blocks.service';
import { BlockActionResultDto, BlockedMutedUserDto } from './dto/block.dto';

@ApiTags('blocks')
@ApiBearerAuth()
@Controller('api')
@Throttle(ThrottlePolicies.write)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get('me/blocks')
  @ApiOperation({ summary: 'Engellediğim kullanıcılar' })
  @ApiResponse({ status: 200, type: [BlockedMutedUserDto] })
  async listBlocks(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<BlockedMutedUserDto>> {
    return { items: await this.blocks.listBlockedUsers(user.userId) };
  }

  @Get('me/mutes')
  @ApiOperation({ summary: 'Susturduğum kullanıcılar' })
  @ApiResponse({ status: 200, type: [BlockedMutedUserDto] })
  async listMutes(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<BlockedMutedUserDto>> {
    return { items: await this.blocks.listMutedUsers(user.userId) };
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Kullanıcıyı engelle (201 / 200 unchanged / 404)' })
  @ApiResponse({ status: 201, type: BlockActionResultDto })
  @ApiResponse({ status: 200, type: BlockActionResultDto })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BlockActionResultDto> {
    const outcome = await this.blocks.block(user.userId, id);
    if (outcome === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.CREATED);
    return { success: true };
  }

  @Delete('users/:id/block')
  @ApiOperation({ summary: 'Engeli kaldır' })
  @ApiResponse({ status: 200, type: BlockActionResultDto })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BlockActionResultDto> {
    const outcome = await this.blocks.unblock(user.userId, id);
    return outcome === 'unblocked' ? { success: true } : { unchanged: true };
  }

  @Post('users/:id/mute')
  @ApiOperation({ summary: 'Kullanıcıyı sustur (201 / 200 unchanged / 404)' })
  @ApiResponse({ status: 201, type: BlockActionResultDto })
  @ApiResponse({ status: 200, type: BlockActionResultDto })
  async mute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BlockActionResultDto> {
    const outcome = await this.blocks.mute(user.userId, id);
    if (outcome === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.CREATED);
    return { success: true };
  }

  @Delete('users/:id/mute')
  @ApiOperation({ summary: 'Susturmayı kaldır' })
  @ApiResponse({ status: 200, type: BlockActionResultDto })
  async unmute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BlockActionResultDto> {
    const outcome = await this.blocks.unmute(user.userId, id);
    return outcome === 'unmuted' ? { success: true } : { unchanged: true };
  }
}
