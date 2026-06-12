import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AWS S3 (prod) / MinIO (lokal — S3_ENDPOINT + forcePathStyle) storage.
 * docs/04 R2 yerine S3 (proje kararı). Deterministik key (re-sync ezme, orphan yok).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('s3.endpoint');
    this.client = new S3Client({
      region: this.config.getOrThrow<string>('s3.region'),
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: this.config.get<boolean>('s3.forcePathStyle'),
          }
        : {}),
      credentials: {
        accessKeyId: this.config.get<string>('s3.accessKeyId') ?? '',
        secretAccessKey: this.config.get<string>('s3.secretAccessKey') ?? '',
      },
    });
    this.bucket = this.config.get<string>('s3.bucket') ?? '';
    this.publicBaseUrl = (
      this.config.get<string>('s3.publicBaseUrl') ?? ''
    ).replace(/\/$/, '');
  }

  async upload(
    buffer: Buffer,
    folder: string,
    fileName: string,
    contentType = 'image/webp',
  ): Promise<string> {
    const key = `${folder}/${fileName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Key deterministik (entityId.webp) ve güncellemede AYNI key ezilir →
        // immutable KULLANMA (eski görsel takılı kalır). 1 gün cache: mobil hız +
        // güncelleme en geç 1 günde yansır.
        CacheControl: 'public, max-age=86400',
      }),
    );
    this.logger.log(`S3 upload: ${key}`);
    return `${this.publicBaseUrl}/${key}`;
  }

  async delete(cdnUrl: string): Promise<void> {
    const key = cdnUrl.replace(`${this.publicBaseUrl}/`, '');
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`S3 delete: ${key}`);
  }
}
