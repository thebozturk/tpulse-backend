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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import {
  BulkDeleteNewsDto,
  CreateNewsDto,
  DeletedCountResponseDto,
  NewsIdResponseDto,
  UpdateNewsDto,
} from './dto/news-write.dto';
import { NewsService } from './news.service';

@ApiTags('admin-news')
@ApiBearerAuth()
@Controller('api/admin/news')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Haber olustur' })
  @ApiSingleResponse(NewsIdResponseDto, 201)
  async create(
    @Body() dto: CreateNewsDto,
  ): Promise<SingleResponse<{ newsId: string }>> {
    const { id } = await this.news.create(dto);
    return { data: { newsId: id } };
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Toplu haber sil (<=100)' })
  @ApiSingleResponse(DeletedCountResponseDto)
  async removeBulk(
    @Body() dto: BulkDeleteNewsDto,
  ): Promise<SingleResponse<{ deletedCount: number }>> {
    return { data: { deletedCount: await this.news.removeBulk(dto.ids) } };
  }

  @Put(':newsId')
  @ApiOperation({ summary: 'Haber guncelle' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async update(
    @Param('newsId', ParseUUIDPipe) newsId: string,
    @Body() dto: UpdateNewsDto,
  ): Promise<{ success: boolean }> {
    await this.news.update(newsId, dto);
    return { success: true };
  }

  @Delete(':newsId')
  @ApiOperation({ summary: 'Haber sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async remove(
    @Param('newsId', ParseUUIDPipe) newsId: string,
  ): Promise<{ success: boolean }> {
    await this.news.remove(newsId);
    return { success: true };
  }
}
