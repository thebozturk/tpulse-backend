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
import {
  BulkDeleteNewsDto,
  CreateNewsDto,
  UpdateNewsDto,
} from './dto/news-write.dto';
import { NewsService } from './news.service';

@ApiTags('admin-news')
@ApiBearerAuth()
@Controller('api/admin/news')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Haber oluştur' })
  async create(
    @Body() dto: CreateNewsDto,
  ): Promise<SingleResponse<{ newsId: string }>> {
    const { id } = await this.news.create(dto);
    return { data: { newsId: id } };
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Toplu haber sil (≤100)' })
  async removeBulk(
    @Body() dto: BulkDeleteNewsDto,
  ): Promise<SingleResponse<{ deletedCount: number }>> {
    return { data: { deletedCount: await this.news.removeBulk(dto.ids) } };
  }

  @Put(':newsId')
  @ApiOperation({ summary: 'Haber güncelle' })
  async update(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @Body() dto: UpdateNewsDto,
  ): Promise<{ success: boolean }> {
    await this.news.update(newsId, dto);
    return { success: true };
  }

  @Delete(':newsId')
  @ApiOperation({ summary: 'Haber sil' })
  async remove(
    @Param('newsId', ParseUUIDPipe) newsId: string,
  ): Promise<{ success: boolean }> {
    await this.news.remove(newsId);
    return { success: true };
  }
}
