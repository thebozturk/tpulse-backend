import {
  Body,
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
import { AddMutedKeywordDto, MutedKeywordDto } from './dto/block.dto';

@ApiTags('muted-keywords')
@ApiBearerAuth()
@Controller('api/me/muted-keywords')
@Throttle(ThrottlePolicies.write)
export class MutedKeywordsController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  @ApiOperation({ summary: 'Susturulan kelimelerim' })
  @ApiResponse({ status: 200, type: [MutedKeywordDto] })
  async list(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<MutedKeywordDto>> {
    return { items: await this.blocks.listKeywords(user.userId) };
  }

  @Post()
  @ApiOperation({ summary: 'Kelime sustur (201 / 200 zaten var)' })
  @ApiResponse({ status: 201, type: MutedKeywordDto })
  @ApiResponse({ status: 200, description: 'Zaten susturulmuş' })
  async add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMutedKeywordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MutedKeywordDto | { unchanged: true }> {
    const outcome = await this.blocks.addKeyword(user.userId, dto.keyword);
    if (outcome.status === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.CREATED);
    return outcome.keyword;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Susturulan kelimeyi kaldır' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 404, description: 'Kelime bulunamadı' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.blocks.removeKeyword(user.userId, id);
    return { success: true };
  }
}
