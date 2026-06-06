import {
  Body,
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
import { AuditAction } from '../../common/audit/audit-actions';
import { Audit } from '../../common/audit/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
import { BroadcastService } from './broadcast.service';
import { BroadcastResponseDto } from './dto/broadcast.response.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@ApiTags('admin-broadcast')
@ApiBearerAuth()
@Controller('api/admin/notifications')
@UseGuards(RolesGuard)
@Roles('Admin')
export class BroadcastController {
  constructor(private readonly broadcast: BroadcastService) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(ThrottlePolicies.adminBulk)
  @Audit(AuditAction.NotificationBroadcast)
  @ApiOperation({ summary: 'Toplu bildirim gönder (kuyruğa alınır)' })
  @ApiSingleResponse(BroadcastResponseDto, 202)
  async send(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateBroadcastDto,
  ): Promise<SingleResponse<BroadcastResponseDto>> {
    return { data: await this.broadcast.enqueue(userId, dto) };
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'Gönderim geçmişi (paged)' })
  @ApiPagedResponse(BroadcastResponseDto)
  history(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<BroadcastResponseDto>> {
    return this.broadcast.history(query.page, query.pageSize);
  }
}
