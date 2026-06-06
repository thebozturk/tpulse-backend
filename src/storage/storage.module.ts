import { Global, Module } from '@nestjs/common';
import { ImageDownloaderService } from './image-downloader.service';
import { ImageMirrorService } from './image-mirror.service';
import { ImageUploadService } from './image-upload.service';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    StorageService,
    ImageService,
    ImageDownloaderService,
    ImageMirrorService,
    ImageUploadService,
  ],
  exports: [
    StorageService,
    ImageService,
    ImageDownloaderService,
    ImageMirrorService,
    ImageUploadService,
  ],
})
export class StorageModule {}
