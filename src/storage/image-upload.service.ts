import { BadRequestException, Injectable } from '@nestjs/common';
import { ImageMirrorService } from './image-mirror.service';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

/** Görsel controller'ları için ortak akış: validate → WebP → S3 (deterministik key). */
@Injectable()
export class ImageUploadService {
  constructor(
    private readonly image: ImageService,
    private readonly storage: StorageService,
    private readonly mirror: ImageMirrorService,
  ) {}

  async fromFile(
    file: Express.Multer.File | undefined,
    folder: string,
    entityId: string,
    quality = 80,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Görsel dosyası gerekli');
    }
    if (!this.image.isValidFormat(file.originalname)) {
      throw new BadRequestException('Geçersiz format (jpg/jpeg/png/webp)');
    }
    if (!this.image.isValidSize(file.size)) {
      throw new BadRequestException('Görsel 5MB sınırını aşıyor');
    }
    if (!this.image.hasAllowedImageSignature(file.buffer)) {
      throw new BadRequestException('Dosya içeriği geçerli bir görsel değil');
    }
    const webp = await this.image.toWebP(file.buffer, quality);
    return this.storage.upload(webp, folder, `${entityId}.webp`, 'image/webp');
  }

  fromUrl(
    url: string,
    folder: string,
    entityId: string,
    quality = 80,
  ): Promise<string> {
    return this.mirror.mirror(url, folder, entityId, quality);
  }
}
