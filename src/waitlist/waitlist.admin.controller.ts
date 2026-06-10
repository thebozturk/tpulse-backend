import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '../common/audit/audit-actions';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
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
import { LaunchCampaignResponseDto } from './dto/launch-campaign.response.dto';
import { WaitlistStatsResponseDto } from './dto/waitlist-stats.response.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('admin-waitlist')
@ApiBearerAuth()
@Controller('api/admin/waitlist')
@UseGuards(RolesGuard)
@Roles('Admin')
export class WaitlistAdminController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post('launch')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(ThrottlePolicies.adminBulk)
  @Audit(AuditAction.WaitlistLaunch)
  @ApiOperation({
    summary: "Lansmanı başlat — sabit backend template'ini kuyruğa al",
    description:
      "Gövde almaz. İçerik backend'de sabittir (launch.content.ts); buton " +
      'yalnızca sıralı gönderimi tetikler.',
  })
  @ApiSingleResponse(LaunchCampaignResponseDto, 202)
  async launch(
    @CurrentUser('userId') userId: string,
  ): Promise<SingleResponse<LaunchCampaignResponseDto>> {
    return { data: await this.waitlist.enqueueLaunch(userId) };
  }

  @Get('launches')
  @ApiOperation({ summary: 'Lansman kampanyası geçmişi + durum (paged)' })
  @ApiPagedResponse(LaunchCampaignResponseDto)
  history(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<LaunchCampaignResponseDto>> {
    return this.waitlist.history(query.page, query.pageSize);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Waitlist özet sayıları' })
  @ApiSingleResponse(WaitlistStatsResponseDto)
  async stats(): Promise<SingleResponse<WaitlistStatsResponseDto>> {
    return { data: await this.waitlist.stats() };
  }
}
