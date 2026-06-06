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
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ImageUrlDto } from './dto/league-write.dto';
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
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Lig logosu yükle' })
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
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Lig logosu değiştir' })
  async replace(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.leagues.setImageFromFile(leagueId, file) },
    };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL’den lig logosu' })
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
  async remove(
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
  ): Promise<{ success: boolean }> {
    await this.leagues.deleteImage(leagueId);
    return { success: true };
  }
}
