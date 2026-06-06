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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SingleResponse } from '../common/interfaces/response.interface';
import { LeagueWriteDto } from './dto/league-write.dto';
import { LeagueCreatedResponseDto } from './dto/league-admin-response.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('admin-leagues')
@ApiBearerAuth()
@Controller('api/admin/leagues')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminLeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lig olustur' })
  @ApiSingleResponse(LeagueCreatedResponseDto, 201)
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(
    @Body() dto: LeagueWriteDto,
  ): Promise<SingleResponse<{ leagueId: string }>> {
    const { id } = await this.leagues.create(dto);
    return { data: { leagueId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Lig guncelle' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'League not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeagueWriteDto,
  ): Promise<{ success: boolean }> {
    await this.leagues.update(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Lig sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'League not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.leagues.remove(id);
    return { success: true };
  }
}
