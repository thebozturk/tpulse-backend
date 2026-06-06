import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UploadedFile,
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
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { ImageUrlDto } from '../common/dto/image-url.dto';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { ProfilePhotoUrlDto } from './dto/profile-photo-url.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('api/profile/photo')
@Throttle(ThrottlePolicies.write)
export class ProfilePhotoController {
  constructor(private readonly profile: ProfileService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Profil fotoğrafı yükle' })
  @ApiSingleResponse(ProfilePhotoUrlDto, 201)
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.profile.setFromFile(user.userId, file) } };
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Profil fotoğrafı değiştir' })
  @ApiSingleResponse(ProfilePhotoUrlDto)
  async replace(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.profile.setFromFile(user.userId, file) } };
  }

  @Post('from-url')
  @ApiOperation({ summary: 'URL’den profil fotoğrafı' })
  @ApiSingleResponse(ProfilePhotoUrlDto, 201)
  async fromUrl(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImageUrlDto,
  ): Promise<SingleResponse<{ url: string }>> {
    return {
      data: { url: await this.profile.setFromUrl(user.userId, dto.imageUrl) },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Profil fotoğrafını getir' })
  @ApiSingleResponse(ProfilePhotoUrlDto)
  async get(
    @CurrentUser() user: AuthUser,
  ): Promise<SingleResponse<{ url: string }>> {
    return { data: { url: await this.profile.get(user.userId) } };
  }

  @Delete()
  @ApiOperation({ summary: 'Profil fotoğrafını sil' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async remove(@CurrentUser() user: AuthUser): Promise<{ success: boolean }> {
    await this.profile.remove(user.userId);
    return { success: true };
  }
}
