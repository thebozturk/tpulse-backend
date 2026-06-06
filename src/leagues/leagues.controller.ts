import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { LeagueResponseDto } from './dto/league-response.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('leagues')
@Controller('api/leagues')
@Public()
export class LeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Get()
  @ApiOperation({ summary: 'Ligleri listele (paged)' })
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<LeagueResponseDto>> {
    return this.leagues.findAll(query.page, query.pageSize);
  }

  @Get('by-code/:code')
  @ApiOperation({ summary: 'Lig kodu ile getir' })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  @ApiResponse({ status: 404 })
  async findByCode(
    @Param('code') code: string,
  ): Promise<SingleResponse<LeagueResponseDto>> {
    return { data: await this.leagues.findByCode(code) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ligi getir' })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<LeagueResponseDto>> {
    return { data: await this.leagues.findById(id) };
  }
}
