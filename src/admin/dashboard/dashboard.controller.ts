import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SingleResponse } from '../../common/interfaces/response.interface';
import { ApiSingleResponse } from '../../common/swagger/api-envelope.decorators';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.response.dto';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Controller('api/admin/dashboard')
@UseGuards(RolesGuard)
@Roles('Admin')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Back office genel bakış metrikleri' })
  @ApiSingleResponse(DashboardOverviewResponseDto)
  async overview(): Promise<SingleResponse<DashboardOverviewResponseDto>> {
    return { data: await this.dashboard.getOverview() };
  }
}
