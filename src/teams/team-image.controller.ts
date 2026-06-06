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
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SingleResponse } from '../common/interfaces/response.interface';
import { TeamImageUrlResponseDto } from './dto/team-image-url-response.dto';
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
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Takim logosu yukle' })
  @ApiSingleResponse(TeamImageUrlResponseDto, 201)
  @ApiResponse({ status: 404, description: 'Team not found' })
  async upload(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.teams.setImageFromFile(teamId, file) } };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Takim logosu degistir' })
  @ApiSingleResponse(TeamImageUrlResponseDto)
  @ApiResponse({ status: 404, description: 'Team not found' })
  async replace(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.teams.setImageFromFile(teamId, file) } };
  }

  @Post('from-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'URL den takim logosu' })
  @ApiSingleResponse(TeamImageUrlResponseDto, 201)
  @ApiResponse({ status: 404, description: 'Team not found' })
  async fromUrl(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.teams.setImageFromUrl(teamId, dto.imageUrl) },
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Takim logosu sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<{ success: boolean }> {
    await this.teams.deleteImage(teamId);
    return { success: true };
  }
}
