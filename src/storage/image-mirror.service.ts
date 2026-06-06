import { Injectable } from '@nestjs/common';
import { ImageDownloaderService } from './image-downloader.service';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

/** Dış görseli indir→WebP→S3'e yükle (deterministik dosya adı). Faz 7 sync + from-url kullanır. */
@Injectable()
export class ImageMirrorService {
  constructor(
    private readonly downloader: ImageDownloaderService,
    private readonly image: ImageService,
    private readonly storage: StorageService,
  ) {}

  async mirror(
    sourceUrl: string,
    folder: string,
    entityId: string,
    quality = 80,
  ): Promise<string> {
    const buffer = await this.downloader.download(sourceUrl);
    const webp = await this.image.toWebP(buffer, quality);
    return this.storage.upload(webp, folder, `${entityId}.webp`, 'image/webp');
  }
}
