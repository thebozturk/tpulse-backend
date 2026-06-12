import { Injectable } from '@nestjs/common';
import sharp = require('sharp');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_MB = 5;

// Magic bytes — uzantı/MIME header'a güvenme, dosyanın gerçek imzasını oku.
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_ASCII = 'RIFF'; // WebP container: bytes 0-3
const WEBP_ASCII = 'WEBP'; // WebP container: bytes 8-11

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

  /**
   * Gerçek byte imzası izin verilen bir görsel mi (JPEG/PNG/WebP)?
   * Uzantı ve MIME header sahteyse bile içerik kontrolü yapar.
   */
  hasAllowedImageSignature(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) {
      return false;
    }
    return (
      this.matches(buffer, JPEG_SIGNATURE) ||
      this.matches(buffer, PNG_SIGNATURE) ||
      this.isWebp(buffer)
    );
  }

  private matches(buffer: Buffer, signature: number[]): boolean {
    return signature.every((byte, i) => buffer[i] === byte);
  }

  private isWebp(buffer: Buffer): boolean {
    return (
      buffer.toString('ascii', 0, 4) === RIFF_ASCII &&
      buffer.toString('ascii', 8, 12) === WEBP_ASCII
    );
  }
}
