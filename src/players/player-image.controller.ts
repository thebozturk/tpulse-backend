import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { PlayersService } from './players.service';

@ApiTags('admin-players')
@ApiBearerAuth()
@Controller('api/admin/players/:playerId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PlayerImageController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Oyuncu fotoğrafı yükle' })
  async upload(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.players.setImageFromFile(playerId, file) },
    };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Oyuncu fotoğrafı değiştir' })
  async replace(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.players.setImageFromFile(playerId, file) },
    };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL’den oyuncu fotoğrafı' })
  async fromUrl(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.players.setImageFromUrl(playerId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Oyuncu fotoğrafı sil' })
  async remove(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<{ success: boolean }> {
    await this.players.deleteImage(playerId);
    return { success: true };
  }
}
