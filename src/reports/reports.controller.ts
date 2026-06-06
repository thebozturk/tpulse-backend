import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportResponseDto } from './dto/report.response.dto';
import { ReportsService } from './reports.service';

// Global JwtAuthGuard — herhangi bir oturum açmış kullanıcı raporlayabilir.
@ApiTags('reports')
@ApiBearerAuth()
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({ summary: 'İçerik raporla' })
  @ApiSingleResponse(ReportResponseDto, 201)
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReportDto,
  ): Promise<SingleResponse<ReportResponseDto>> {
    return { data: await this.reports.create(userId, dto) };
  }
}
