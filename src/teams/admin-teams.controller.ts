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
import { TeamIdResponseDto } from './dto/team-id-response.dto';
import { TeamWriteDto } from './dto/team-write.dto';
import { TeamsService } from './teams.service';

@ApiTags('admin-teams')
@ApiBearerAuth()
@Controller('api/admin/teams')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminTeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Takim olustur' })
  @ApiSingleResponse(TeamIdResponseDto, 201)
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(
    @Body() dto: TeamWriteDto,
  ): Promise<SingleResponse<{ teamId: string }>> {
    const { id } = await this.teams.create(dto);
    return { data: { teamId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Takim guncelle' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TeamWriteDto,
  ): Promise<{ success: boolean }> {
    await this.teams.update(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Takim sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.teams.remove(id);
    return { success: true };
  }
}
