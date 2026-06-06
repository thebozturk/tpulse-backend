import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Queue } from 'bullmq';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ListResponse,
  SingleResponse,
} from '../common/interfaces/response.interface';
import { SyncRunDto } from '../integration/api-football/dto/seed-result.dto';
import { FootballDataSyncService } from '../integration/api-football/football-data.sync.service';
import { SYNC_QUEUE } from './sync.processor';

@ApiTags('admin-sync')
@ApiBearerAuth()
@Controller('api/admin/sync')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminSyncController {
  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
    private readonly sync: FootballDataSyncService,
  ) {}

  @Post('football-data')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Tüm ligleri senkronla (async)' })
  async syncAll(): Promise<SingleResponse<{ jobId: string }>> {
    const job = await this.queue.add('sync', {});
    return { data: { jobId: String(job.id) } };
  }

  @Post('football-data/leagues/:leagueExternalId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Tek ligi senkronla (async)' })
  async syncLeague(
    @Param('leagueExternalId', ParseIntPipe) leagueExternalId: number,
  ): Promise<SingleResponse<{ jobId: string; leagueExternalId: number }>> {
    const job = await this.queue.add('sync', { leagueExternalId });
    return { data: { jobId: String(job.id), leagueExternalId } };
  }

  @Get('runs')
  @ApiOperation({ summary: 'Sync audit kayıtları' })
  async runs(
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ): Promise<ListResponse<SyncRunDto>> {
    const items = await this.sync.getRuns(Math.min(take ?? 20, 100));
    return { items };
  }
}
