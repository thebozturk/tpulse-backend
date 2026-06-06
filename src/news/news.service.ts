import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagedResult } from '../common/interfaces/response.interface';
import { buildPaged } from '../common/pagination';
import { ImageUploadService } from '../storage/image-upload.service';
import { NewsResponseDto } from './dto/news-response.dto';
import {
  NewsBySourceDto,
  NewsDateRangeDto,
  NewsQueryDto,
} from './dto/news-query.dto';
import { CreateNewsDto, UpdateNewsDto } from './dto/news-write.dto';
import { toNewsResponse } from './news.mapper';
import { INewsRepository, NEWS_REPOSITORY } from './news.repository';

const IMAGE_FOLDER = 'news';
const IMAGE_QUALITY = 80;

@Injectable()
export class NewsService {
  constructor(
    @Inject(NEWS_REPOSITORY) private readonly repo: INewsRepository,
    private readonly imageUpload: ImageUploadService,
  ) {}

  create(dto: CreateNewsDto): Promise<{ id: string }> {
    return this.repo.create(dto);
  }

  async update(id: string, dto: UpdateNewsDto): Promise<void> {
    if (dto.newsId !== id) {
      throw new BadRequestException('Route id ile body newsId uyuşmuyor');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { newsId, ...data } = dto;
    if (!(await this.repo.update(id, data))) {
      throw new NotFoundException('Haber bulunamadı');
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.remove(id))) {
      throw new NotFoundException('Haber bulunamadı');
    }
  }

  removeBulk(ids: string[]): Promise<number> {
    return this.repo.removeBulk(ids);
  }

  async setImageFromFile(
    id: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Haber bulunamadı');
    }
    const url = await this.imageUpload.fromFile(
      file,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url);
    return url;
  }

  async setImageFromUrl(id: string, imageUrl: string): Promise<string> {
    if (!(await this.repo.exists(id))) {
      throw new NotFoundException('Haber bulunamadı');
    }
    const url = await this.imageUpload.fromUrl(
      imageUrl,
      IMAGE_FOLDER,
      id,
      IMAGE_QUALITY,
    );
    await this.repo.updateImage(id, url);
    return url;
  }

  async deleteImage(id: string): Promise<void> {
    if (!(await this.repo.updateImage(id, null))) {
      throw new NotFoundException('Haber bulunamadı');
    }
  }

  async findAll(query: NewsQueryDto): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getAll(
      query.page,
      query.pageSize,
      query.sortBy,
      query.order,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  async findById(id: string): Promise<NewsResponseDto> {
    const news = await this.repo.getById(id);
    if (!news) {
      throw new NotFoundException('Haber bulunamadı');
    }
    return toNewsResponse(news);
  }

  async findByPlayer(
    playerId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByPlayerId(
      playerId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findByToTeam(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByToTeamId(
      teamId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findByFromTeam(
    teamId: string,
    page: number,
    pageSize: number,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByFromTeamId(
      teamId,
      page,
      pageSize,
    );
    return this.page(items, total, page, pageSize);
  }

  async findBySource(
    query: NewsBySourceDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getBySourceName(
      query.sourceName,
      query.page,
      query.pageSize,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  async findByDateRange(
    query: NewsDateRangeDto,
  ): Promise<PagedResult<NewsResponseDto>> {
    const { items, total } = await this.repo.getByDateRange(
      query.startDate,
      query.endDate,
      query.page,
      query.pageSize,
    );
    return this.page(items, total, query.page, query.pageSize);
  }

  private page(
    items: Parameters<typeof toNewsResponse>[0][],
    total: number,
    page: number,
    pageSize: number,
  ): PagedResult<NewsResponseDto> {
    return buildPaged(items.map(toNewsResponse), total, page, pageSize);
  }
}
