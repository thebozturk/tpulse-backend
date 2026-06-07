import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { IngestPostDto } from './dto/ingest-post.dto';
import { IngestResultDto } from './dto/ingest-result.response.dto';
import { IngestionService } from './ingestion.service';

/**
 * Bot ingestion. JWT yerine X-Api-Key (ApiKeyGuard). @Public ile global JwtAuthGuard bypass.
 */
@ApiTags('ingestion')
@ApiSecurity('api-key')
@Controller('api/ingest')
@Public()
@UseGuards(ApiKeyGuard)
export class IngestController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(ThrottlePolicies.write)
  @ApiOperation({
    summary: 'Bot içeriğini akışa ekle (duyum/son dakika/resmi)',
  })
  @ApiSingleResponse(IngestResultDto, 201)
  async ingestPost(
    @Body() dto: IngestPostDto,
  ): Promise<SingleResponse<IngestResultDto>> {
    return { data: await this.ingestion.ingestPost(dto) };
  }
}
