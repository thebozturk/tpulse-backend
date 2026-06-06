import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { LeagueWriteDto } from './dto/league-write.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('admin-leagues')
@ApiBearerAuth()
@Controller('api/admin/leagues')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AdminLeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lig oluştur' })
  async create(
    @Body() dto: LeagueWriteDto,
  ): Promise<SingleResponse<{ leagueId: string }>> {
    const { id } = await this.leagues.create(dto);
    return { data: { leagueId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Lig güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeagueWriteDto,
  ): Promise<{ success: boolean }> {
    await this.leagues.update(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Lig sil' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.leagues.remove(id);
    return { success: true };
  }
}
