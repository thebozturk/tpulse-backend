import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import {
  ApiListResponse,
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import {
  ListResponse,
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { LatestQueryDto, RumourFilterDto } from './dto/transfer-query.dto';
import { RumoursService } from './rumours.service';

@ApiTags('rumours')
@Controller('api/rumours')
@Public()
export class RumourController {
  constructor(private readonly rumours: RumoursService) {}

  @Get()
  @ApiOperation({ summary: 'Söylentileri filtrele (paged)' })
  @ApiPagedResponse(TransferResponseDto)
  findAll(
    @Query() filter: RumourFilterDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.rumours.query(filter);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Son söylentiler' })
  @ApiPagedResponse(TransferResponseDto)
  async latest(
    @Query() dto: LatestQueryDto,
  ): Promise<PagedResult<TransferResponseDto>> {
    return this.rumours.latest(dto);
  }

  @Get('by-player/:playerId')
  @ApiOperation({ summary: 'Oyuncuya göre söylentiler' })
  @ApiListResponse(TransferResponseDto)
  async byPlayer(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.rumours.byPlayer(playerId) };
  }

  @Get('by-team/:teamId')
  @ApiOperation({ summary: 'Takıma göre söylentiler' })
  @ApiListResponse(TransferResponseDto)
  async byTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ListResponse<TransferResponseDto>> {
    return { items: await this.rumours.byTeam(teamId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Söylentiyi getir' })
  @ApiSingleResponse(TransferResponseDto)
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TransferResponseDto>> {
    return { data: await this.rumours.findById(id) };
  }
}
