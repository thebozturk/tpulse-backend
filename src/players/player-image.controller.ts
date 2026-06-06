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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { PlayersService } from './players.service';

@ApiTags('admin-players')
@ApiBearerAuth()
@Controller('api/admin/players/:playerId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class PlayerImageController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Oyuncu fotoğrafı yükle' })
  @ApiSingleResponse(ImageUploadResponseDto, 201)
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
  @ApiSingleResponse(ImageUploadResponseDto)
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
  @ApiSingleResponse(ImageUploadResponseDto, 201)
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
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async remove(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ): Promise<{ success: boolean }> {
    await this.players.deleteImage(playerId);
    return { success: true };
  }
}
