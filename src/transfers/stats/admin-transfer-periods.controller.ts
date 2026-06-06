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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../../common/throttle/throttle-policies';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SuccessResponseDto } from '../../common/dto/common-response.dto';
import {
  ApiListResponse,
  ApiSingleResponse,
} from '../../common/swagger/api-envelope.decorators';
import {
  ListResponse,
  SingleResponse,
} from '../../common/interfaces/response.interface';
import { AdminPeriodsService } from './admin-periods.service';
import { PeriodWriteDto } from './dto/period-write.dto';
import { PeriodsQueryDto } from './dto/stats-query.dto';
import { PeriodIdResponseDto } from './dto/period-id-response.dto';
import { TransferPeriodDto } from './dto/transfer-period.dto';

@ApiTags('admin-transfer-periods')
@ApiBearerAuth()
@Controller('api/admin/transfer-periods')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminTransferPeriodsController {
  constructor(private readonly periods: AdminPeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'Dönemleri listele' })
  @ApiListResponse(TransferPeriodDto)
  async list(
    @Query() query: PeriodsQueryDto,
  ): Promise<ListResponse<TransferPeriodDto>> {
    return { items: await this.periods.list(query.year) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dönemi getir' })
  @ApiSingleResponse(TransferPeriodDto)
  @ApiResponse({ status: 404 })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<TransferPeriodDto>> {
    return { data: await this.periods.getById(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dönem oluştur (endDate>=startDate)' })
  @ApiSingleResponse(PeriodIdResponseDto, 201)
  async create(
    @Body() dto: PeriodWriteDto,
  ): Promise<SingleResponse<{ transferPeriodId: string }>> {
    const { id } = await this.periods.create(dto);
    return { data: { transferPeriodId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Dönem güncelle' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PeriodWriteDto,
  ): Promise<{ success: boolean }> {
    await this.periods.update(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dönem sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.periods.remove(id);
    return { success: true };
  }
}
