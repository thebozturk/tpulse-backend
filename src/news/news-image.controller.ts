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
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { NewsImageUrlResponseDto } from './dto/news-image-response.dto';
import { NewsService } from './news.service';

@ApiTags('admin-news')
@ApiBearerAuth()
@Controller('api/admin/news/:newsId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class NewsImageController {
  constructor(private readonly news: NewsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Haber gorseli yukle' })
  @ApiSingleResponse(NewsImageUrlResponseDto, 201)
  async upload(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.news.setImageFromFile(newsId, file) } };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Haber gorseli degistir' })
  @ApiSingleResponse(NewsImageUrlResponseDto)
  async replace(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.news.setImageFromFile(newsId, file) } };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL den haber gorseli' })
  @ApiSingleResponse(NewsImageUrlResponseDto, 201)
  async fromUrl(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.news.setImageFromUrl(newsId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Haber gorseli sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async remove(
    @Param('newsId', ParseUUIDPipe) newsId: string,
  ): Promise<{ success: boolean }> {
    await this.news.deleteImage(newsId);
    return { success: true };
  }
}
