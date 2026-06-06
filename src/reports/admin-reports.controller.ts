import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  PagedResult,
  SingleResponse,
} from '../common/interfaces/response.interface';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { ReportListQueryDto } from './dto/report-list.query.dto';
import { ReportResponseDto } from './dto/report.response.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('admin-reports')
@ApiBearerAuth()
@Controller('api/admin/reports')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Rapor kuyruğu (status filtreli, paged)' })
  @ApiPagedResponse(ReportResponseDto)
  list(
    @Query() query: ReportListQueryDto,
  ): Promise<PagedResult<ReportResponseDto>> {
    return this.reports.list(query);
  }

  @Patch(':id')
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'Raporu incele/aksiyon al (sil/ban)' })
  @ApiSingleResponse(ReportResponseDto)
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') reviewerUserId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<SingleResponse<ReportResponseDto>> {
    return { data: await this.reports.review(id, reviewerUserId, dto) };
  }
}
