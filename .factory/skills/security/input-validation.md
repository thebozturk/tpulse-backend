---
name: security-input-validation
keywords: "input validation, class-validator, whitelist, sanitize, validation pipe"
description: "Her input'u valide et — class-validator disiplini"
---

# Input Validation

## Temel prensip

**Trust nothing from client.** Her input validated olmadan service katmanına gitmez.

## Global ValidationPipe (ZORUNLU)

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                 // DTO'da olmayan field SİLİNİR
    forbidNonWhitelisted: true,      // Extra field → 400
    transform: true,                  // DTO instance'a dönüştür
    transformOptions: { enableImplicitConversion: true },
    stopAtFirstError: false,          // Tüm hataları göster
    disableErrorMessages: process.env.NODE_ENV === 'production',
  }),
);
```

**Bu YOKSA class-validator decorator'ları boşa.**

## Her field decorator ZORUNLU

```typescript
export class CreateUserDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;
}
```

Post-write-check hook `DTO'da decorator yok` uyarısı verir → düzelt.

## Boundary limit

DoS önlemi için HER string'de `@MaxLength`:
```typescript
@MaxLength(100)    // name
@MaxLength(255)    // email
@MaxLength(2000)   // description
@MaxLength(72)     // password (bcrypt)
```

User gönderir: 100 MB string → memory patlar. Limit ile kes.

## Array limit

```typescript
@IsArray()
@ArrayMaxSize(100)       // 100 item max
@ValidateNested({ each: true })
@Type(() => ItemDto)
items: ItemDto[];
```

1M item'lık array blokla.

## Object nesting limit

```typescript
// Manual validation — çok derin nested → reject
```

class-validator built-in limit yok. Custom validator veya recursive DTO depth check.

## Enum'lar

String yerine enum:
```typescript
// ❌
@IsString()
status: string;  // "admin", "Admin", "aDmIn" geçer

// ✓
@IsEnum(UserStatus)
status: UserStatus;
```

## Transform ile normalize

```typescript
@IsEmail()
@Transform(({ value }) => value?.toLowerCase().trim())
email: string;

@IsString()
@Transform(({ value }) => DOMPurify.sanitize(value))  // XSS clean
comment: string;
```

## URL / redirect validation

Open redirect önlemi:
```typescript
@IsUrl({ require_protocol: true, protocols: ['https'] })
@Transform(({ value }) => {
  const url = new URL(value);
  if (!['app.acme.com', 'admin.acme.com'].includes(url.hostname)) {
    throw new Error('Not allowed');
  }
  return value;
})
redirectUrl: string;
```

User `redirect=https://evil.com` gönderemesin.

## Query parameter

```typescript
export class ListQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional() @IsString() @Matches(/^-?(createdAt|name)$/)
  sort?: string;

  @IsOptional() @IsEnum(['active', 'banned'])
  status?: string;
}

// Controller
@Get()
async list(@Query() query: ListQueryDto) { ... }
```

String → number auto convert (`enableImplicitConversion`).

## Path parameter

```typescript
@Get(':id')
async findOne(@Param('id', ObjectIdPipe) id: string) { ... }

// Custom ObjectIdPipe
@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new BadRequestException('Invalid id format');
    }
    return value;
  }
}
```

URL `/users/; DROP TABLE` gibi injection attempt'i block.

## File upload

```typescript
@Post('avatar')
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 5_000_000 },
    fileFilter: (req, file, cb) => {
      if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
        return cb(new BadRequestException('Invalid type'), false);
      }
      cb(null, true);
    },
  }),
)
async upload(@UploadedFile() file: Express.Multer.File) {
  // Magic bytes check (MIME header güvenilmez!)
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !['image/jpeg', 'image/png'].includes(type.mime)) {
    throw new BadRequestException('Invalid file');
  }
  // ...
}
```

Bkz. `api/file-upload.md`.

## ReDoS önlemi

Regex pattern'leri user-controlled ise:
```typescript
// ❌ ReDoS riski
@Matches(req.query.pattern)

// ❌ Catastrophic regex
@Matches(/^(a+)+$/)  // "aaaaaaaaaaaaaaab" → O(2^n)
```

Server-side regex'leri benchmark et. Hedef <10ms her input için.

Safe regex library:
```bash
pnpm add re2
```

`re2` linear time, ReDoS-immune.

## SQL/NoSQL injection

Class-validator whitelist + forbidNonWhitelisted → object injection önler:
```typescript
// Client: { "email": { "$ne": null } }
// forbidNonWhitelisted → 400 (email string olmalı)
```

Bkz. `mongodb/security.md`.

## XSS önleme

```typescript
import DOMPurify from 'isomorphic-dompurify';

@Transform(({ value }) => DOMPurify.sanitize(value, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
}))
description: string;
```

Veya: HTML hiç izin verme, plain text sakla, frontend render'da escape.

## Anti-pattern'ler

### No ValidationPipe
```typescript
// ❌
app.listen(3000);  // decorator'lar boş
```

### Whitelist kapalı
```typescript
// ❌ Extra field geçer
new ValidationPipe({ whitelist: false });
```

### Length limit yok
```typescript
@IsString()
description: string;  // ❌ 100MB gelir → OOM
```

### `@Allow()` kullanma
```typescript
@Allow()
settings: any;  // ❌ her şey geçer
```

### Type `any`
```typescript
@IsObject()
metadata: any;  // ❌ nested validation yok
```

## Aksiyon

1. Global ValidationPipe (whitelist + forbidNonWhitelisted)
2. Her DTO field'da validator decorator
3. Her string'de MaxLength (DoS)
4. Array'de ArrayMaxSize
5. Enum için IsEnum
6. URL için IsUrl + hostname whitelist
7. ObjectId param pipe
8. File: size + MIME + magic bytes
9. Regex pattern ReDoS-safe
