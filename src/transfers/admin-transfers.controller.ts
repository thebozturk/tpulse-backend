import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { AdminTransfersService } from './admin-transfers.service';
import { CreateTransferDto, PatchTransferDto } from './dto/transfer-write.dto';

@ApiTags('admin-transfers')
@ApiBearerAuth()
@Controller('api/admin/transfers')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AdminTransfersController {
  constructor(private readonly admin: AdminTransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transfer oluştur (dup 409)' })
  async create(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<{ transferId: string }>> {
    const { id } = await this.admin.create(dto, user.userId);
    return { data: { transferId: id } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Transfer güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTransferDto,
  ): Promise<{ success: boolean }> {
    await this.admin.update(id, dto);
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Transfer kısmi güncelle' })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchTransferDto,
  ): Promise<{ success: boolean }> {
    await this.admin.patch(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Transfer sil (soft-delete)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.admin.remove(id);
    return { success: true };
  }
}
