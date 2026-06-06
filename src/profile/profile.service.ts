import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ImageUploadService } from '../storage/image-upload.service';

const IMAGE_FOLDER = 'profiles';
const IMAGE_QUALITY = 80;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageUpload: ImageUploadService,
  ) {}

  async setFromFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const url = await this.imageUpload.fromFile(
      file,
      IMAGE_FOLDER,
      userId,
      IMAGE_QUALITY,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePic: url },
    });
    return url;
  }

  async setFromUrl(userId: string, imageUrl: string): Promise<string> {
    const url = await this.imageUpload.fromUrl(
      imageUrl,
      IMAGE_FOLDER,
      userId,
      IMAGE_QUALITY,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePic: url },
    });
    return url;
  }

  async get(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePic: true },
    });
    if (!user?.profilePic) {
      throw new NotFoundException('Profil fotoğrafı yok');
    }
    return user.profilePic;
  }

  async remove(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePic: true },
    });
    if (!user?.profilePic) {
      throw new BadRequestException('Silinecek profil fotoğrafı yok');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePic: null },
    });
  }
}
