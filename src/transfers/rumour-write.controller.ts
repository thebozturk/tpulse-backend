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
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ConfirmRumourDto, CreateRumourDto } from './dto/rumour-write.dto';
import { RumourWriteService } from './rumour-write.service';

@ApiTags('rumours')
@ApiBearerAuth()
@Controller('api/rumours')
@UseGuards(RolesGuard)
@Roles('Admin', 'Reporter')
@Throttle(ThrottlePolicies.write)
export class RumourWriteController {
  constructor(private readonly rumours: RumourWriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Söylenti oluştur (Admin/Reporter) — bot kullanır' })
  async create(
    @Body() dto: CreateRumourDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<{ rumourId: string }>> {
    const { id } = await this.rumours.create(dto, user.userId);
    return { data: { rumourId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Söylenti güncelle (yazar veya admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRumourDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.rumours.update(id, user, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Söylenti sil (soft, yazar veya admin)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.rumours.remove(id, user);
    return { success: true };
  }

  @Post(':id/confirm')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Söylentiyi transfere çevir (Admin)' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRumourDto,
  ): Promise<SingleResponse<{ transferId: string }>> {
    return { data: await this.rumours.confirm(id, dto) };
  }
}
