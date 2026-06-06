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
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ImageUrlDto } from './dto/league-write.dto';
import { LeagueImageResponseDto } from './dto/league-admin-response.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('admin-leagues')
@ApiBearerAuth()
@Controller('api/admin/leagues/:leagueId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class LeagueImageController {
  constructor(private readonly leagues: LeaguesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
      required: ['image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Lig logosu yukle' })
  @ApiSingleResponse(LeagueImageResponseDto, 200)
  @ApiResponse({ status: 400, description: 'Dosya gecersiz veya eksik' })
  @ApiResponse({ status: 404, description: 'League not found' })
  async upload(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.leagues.setImageFromFile(leagueId, file) },
    };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
      required: ['image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Lig logosu degistir' })
  @ApiSingleResponse(LeagueImageResponseDto, 200)
  @ApiResponse({ status: 400, description: 'Dosya gecersiz veya eksik' })
  @ApiResponse({ status: 404, description: 'League not found' })
  async replace(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.leagues.setImageFromFile(leagueId, file) },
    };
  }

  @Post('from-url')
  @ApiOperation({ summary: "URL'den lig logosu" })
  @ApiSingleResponse(LeagueImageResponseDto, 200)
  @ApiResponse({ status: 400, description: 'Gecersiz URL' })
  @ApiResponse({ status: 404, description: 'League not found' })
  async fromUrl(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.leagues.setImageFromUrl(leagueId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Lig logosu sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'League not found' })
  async remove(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
  ): Promise<{ success: boolean }> {
    await this.leagues.deleteImage(leagueId);
    return { success: true };
  }
}
