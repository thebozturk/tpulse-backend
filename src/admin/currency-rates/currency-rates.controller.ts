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
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  PagedResult,
  SingleResponse,
} from '../../common/interfaces/response.interface';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../../common/throttle/throttle-policies';
import { CurrencyRatesService } from './currency-rates.service';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { CurrencyRateResponseDto } from './dto/currency-rate.response.dto';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';

@ApiTags('admin-currency-rates')
@ApiBearerAuth()
@Controller('api/admin/currency-rates')
@UseGuards(RolesGuard)
@Roles('Admin')
export class CurrencyRatesController {
  constructor(private readonly rates: CurrencyRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Kurları listele (paged)' })
  @ApiPagedResponse(CurrencyRateResponseDto)
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<CurrencyRateResponseDto>> {
    return this.rates.findAll(query.page, query.pageSize);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'Kur ekle' })
  @ApiSingleResponse(CurrencyRateResponseDto, 201)
  @ApiResponse({ status: 409, description: 'Bu tarih için kur zaten var' })
  async create(
    @Body() dto: CreateCurrencyRateDto,
  ): Promise<SingleResponse<CurrencyRateResponseDto>> {
    return { data: await this.rates.create(dto) };
  }

  @Put(':id')
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'Kur güncelle' })
  @ApiSingleResponse(CurrencyRateResponseDto)
  @ApiResponse({ status: 404 })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurrencyRateDto,
  ): Promise<SingleResponse<CurrencyRateResponseDto>> {
    return { data: await this.rates.update(id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'Kur sil' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rates.remove(id);
  }
}
