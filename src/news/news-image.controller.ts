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
import { NewsService } from './news.service';

@ApiTags('admin-news')
@ApiBearerAuth()
@Controller('api/admin/news/:newsId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class NewsImageController {
  constructor(private readonly news: NewsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Haber görseli yükle' })
  async upload(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.news.setImageFromFile(newsId, file) } };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Haber görseli değiştir' })
  async replace(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.news.setImageFromFile(newsId, file) } };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL’den haber görseli' })
  async fromUrl(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.news.setImageFromUrl(newsId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Haber görseli sil' })
  async remove(
    @Param('newsId', ParseUUIDPipe) newsId: string,
  ): Promise<{ success: boolean }> {
    await this.news.deleteImage(newsId);
    return { success: true };
  }
}
