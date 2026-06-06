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
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { PlayerWriteDto } from './dto/player-write.dto';
import { PlayersService } from './players.service';

@ApiTags('admin-players')
@ApiBearerAuth()
@Controller('api/admin/players')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminPlayersController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Oyuncu oluştur' })
  async create(
    @Body() dto: PlayerWriteDto,
  ): Promise<SingleResponse<{ playerId: string }>> {
    const { id } = await this.players.create(dto);
    return { data: { playerId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Oyuncu güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlayerWriteDto,
  ): Promise<{ success: boolean }> {
    await this.players.updatePlayer(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Oyuncu sil' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.players.remove(id);
    return { success: true };
  }
}
