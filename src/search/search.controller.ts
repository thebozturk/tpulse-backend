import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ReqLang } from '../common/i18n/lang.decorator';
import { Lang } from '../common/i18n/lang';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-result.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('api/search')
@Public()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Fuzzy arama (player/team/league)' })
  @ApiResponse({ status: 200, type: SearchResponseDto })
  @ApiResponse({ status: 400, description: 'q boş' })
  find(
    @Query() query: SearchQueryDto,
    @ReqLang() lang: Lang,
  ): Promise<SearchResponseDto> {
    return this.search.search(query, lang);
  }
}
