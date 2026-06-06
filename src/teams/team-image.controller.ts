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
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { TeamsService } from './teams.service';

@ApiTags('admin-teams')
@ApiBearerAuth()
@Controller('api/admin/teams/:teamId/image')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class TeamImageController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Takım logosu yükle' })
  async upload(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.teams.setImageFromFile(teamId, file) } };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Takım logosu değiştir' })
  async replace(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.teams.setImageFromFile(teamId, file) } };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL’den takım logosu' })
  async fromUrl(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.teams.setImageFromUrl(teamId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Takım logosu sil' })
  async remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<{ success: boolean }> {
    await this.teams.deleteImage(teamId);
    return { success: true };
  }
}
