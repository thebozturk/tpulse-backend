---
name: api-file-upload
keywords: "file, upload, multer, multipart, image, size, MIME"
description: "Secure file upload — size, MIME, magic bytes"
---

# File Upload

## NestJS + Multer

```bash
pnpm add multer @nestjs/platform-express
pnpm add -D @types/multer
```

### Memory storage (tercih — S3'e stream)

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Post('avatar')
@UseInterceptors(
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        return cb(new BadRequestException('Invalid MIME type'), false);
      }
      cb(null, true);
    },
  }),
)
async upload(@UploadedFile() file: Express.Multer.File) {
  // file.buffer → S3'e stream
}
```

## Validation katmanları

### 1. Size (Multer limit)
```typescript
limits: { fileSize: 5 * 1024 * 1024 }  // 5MB
```
Bytes cinsinden. Aşılırsa Multer throw.

### 2. MIME type (Multer fileFilter)
Yukarıdaki örnekte whitelist.

### 3. Magic bytes (en önemli)

**MIME type güvenilmez** — user header göndermiş. Gerçek byte kontrolü:

```bash
pnpm add file-type
```

```typescript
import { fileTypeFromBuffer } from 'file-type';

@Post('avatar')
async upload(@UploadedFile() file: Express.Multer.File) {
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type) throw new BadRequestException('Cannot detect file type');

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(type.mime)) {
    throw new BadRequestException(`Invalid file type: ${type.mime}`);
  }

  // Artık güvenli
}
```

Magic bytes: JPEG `FF D8 FF`, PNG `89 50 4E 47`, vs. Header manipüle edilemez (bytes dosyanın içinde).

### 4. Filename sanitization

User `../../../etc/passwd` veya `<script>.jpg` gönderebilir:
```typescript
import { randomUUID } from 'crypto';
import * as path from 'path';

const ext = path.extname(file.originalname).toLowerCase();
const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
const filename = `${randomUUID()}${safeExt}`;
```

Original name **KULLANMA**. Kendi UUID-based filename üret.

### 5. Image dimension limit

Sharp ile:
```bash
pnpm add sharp
```

```typescript
import * as sharp from 'sharp';

async processAvatar(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();

  if (metadata.width > 5000 || metadata.height > 5000) {
    throw new BadRequestException('Image too large');
  }

  // Resize + optimize
  const resized = await sharp(buffer)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();

  return resized;
}
```

## S3 upload

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AvatarService {
  private readonly s3 = new S3Client({ region: this.config.get('AWS_REGION') });

  async upload(userId: string, buffer: Buffer, mime: string): Promise<string> {
    const key = `avatars/${userId}/${randomUUID()}.jpg`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.get('AWS_S3_BUCKET'),
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000',
    }));

    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
}
```

## Multiple files

```typescript
@Post('images')
@UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 5_000_000 } }))
async uploadMany(@UploadedFiles() files: Express.Multer.File[]) { ... }
```

Max count belirt (DoS önlemi).

## Zip bomb protection

Zip/gzip uploaded edilecekse unzip edilmiş size'ı kontrol et. Compressed 1MB → uncompressed 100GB olabilir.

```typescript
import * as yauzl from 'yauzl';

// Her entry'nin uncompressed size'ını topla, limit kontrol
```

## Anti-pattern'ler

### MIME-only validation
```typescript
// ❌ Header'a güvenme
if (file.mimetype === 'image/jpeg') { ... }
```

### Original filename kullanma
```typescript
// ❌ Path traversal
const path = `/uploads/${file.originalname}`;
```

### Size limit yok
```typescript
// ❌ 10GB dosya → OOM
@UseInterceptors(FileInterceptor('file'))  // limit yok
```

### Disk storage production'da
```typescript
// ❌ Scaling: her instance'ta farklı disk
storage: diskStorage({ destination: './uploads' })
```

### Public access credentials
```typescript
// S3 bucket public read OK ama write ASLA
```

## Aksiyon

1. Memory storage (S3'e stream)
2. Size limit (5MB, ihtiyaca göre)
3. MIME whitelist (fileFilter)
4. Magic bytes doğrulama (file-type)
5. Filename: UUID + sanitized extension
6. Image: dimension + resize + optimize (sharp)
7. S3'e upload, DB'ye URL kaydet
8. Old file silme (user avatar değiştirince)
