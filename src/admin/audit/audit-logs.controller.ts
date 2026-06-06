import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit/audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PagedResult } from '../../common/interfaces/response.interface';
import { ApiPagedResponse } from '../../common/swagger/api-envelope.decorators';
import { AuditLogListQueryDto } from './dto/audit-log-list.query.dto';
import { AuditLogResponseDto } from './dto/audit-log.response.dto';

@ApiTags('admin-audit')
@ApiBearerAuth()
@Controller('api/admin/audit-logs')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Audit kayıtları (actor/action/tarih filtre, paged)',
  })
  @ApiPagedResponse(AuditLogResponseDto)
  list(
    @Query() query: AuditLogListQueryDto,
  ): Promise<PagedResult<AuditLogResponseDto>> {
    return this.audit.list(query);
  }
}
