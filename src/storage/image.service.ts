import { Injectable } from '@nestjs/common';
import sharp = require('sharp');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_MB = 5;

/** Görsel işleme (docs/04 SixLabors→sharp). JPEG/PNG → WebP. */
@Injectable()
export class ImageService {
  toWebP(buffer: Buffer, quality = 80): Promise<Buffer> {
    return sharp(buffer).webp({ quality }).toBuffer();
  }

  isValidFormat(fileName: string): boolean {
    const dot = fileName.lastIndexOf('.');
    if (dot < 0) {
      return false;
    }
    return ALLOWED_EXT.includes(fileName.slice(dot).toLowerCase());
  }

  isValidSize(bytes: number, maxMb = MAX_MB): boolean {
    return bytes > 0 && bytes <= maxMb * 1024 * 1024;
  }
}
