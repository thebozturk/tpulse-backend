---
globs: "src/**/*.dto.ts,src/**/dto/**"
severity: must
---

# DTO Kuralları

`src/**/*.dto.ts` ve `src/**/dto/**` dosyalarında aktif.

## MUST

- Her public field'da class-validator decorator var (@IsString, @IsEmail, vs.)
- Her field `@ApiProperty({ example, description })` taşır (Swagger)
- Password field'ları `@MaxLength(72)` taşır (bcrypt sınırı)
- String field'ları `@MaxLength(N)` taşır (DoS önlemi)
- Email `@IsEmail()` + `@MaxLength(255)`
- Number `@Min` ve `@Max` taşır
- Enum `@IsEnum(SomeEnum)` taşır
- Optional field'lar `@IsOptional()` + `?` suffix
- Array `@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => ItemDto)`

## SHOULD

- DTO ismi: `Create<Entity>Dto`, `Update<Entity>Dto`, `<Entity>ResponseDto`
- Request DTO ≠ Response DTO (genelde farklı field'lar)
- Transformation: `@Transform` ile trim, lowercase (özellikle email)
- Nested DTO için `@Type(() => NestedDto)`

## ASLA

- `any` type
- Decorator'sız public field (validation bypass)
- `@Allow()` decorator (bypass amaçlı)
- DTO'da business logic method
- Response DTO'da sensitive field (password, token)
- `@ApiProperty` olmadan field (Swagger eksik)

## Örnekler

### İyi — Create DTO
```typescript
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export class CreateUserDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'secure-password-123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Alice Smith', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ enum: UserRole, default: UserRole.User })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
```

### İyi — Response DTO (password yok, sadece güvenli field'lar)
```typescript
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() createdAt: Date;
  // password YOK, refreshToken YOK
}
```

### Kötü
```typescript
export class CreateUserDto {
  email: any;                 // ❌ decorator yok, any
  password: string;            // ❌ decorator yok, MaxLength yok
  role: string;                // ❌ enum yerine string
}
```

## Class-validator'un tam listesi (yaygın)

| Decorator | Kullanım |
|-----------|----------|
| `@IsString()` | string |
| `@IsNumber()` | sayı |
| `@IsBoolean()` | boolean |
| `@IsDate()` | Date |
| `@IsEmail()` | email format |
| `@IsUUID()` | UUID format |
| `@IsUrl()` | URL |
| `@IsEnum(E)` | enum değer |
| `@IsArray()` | array |
| `@IsOptional()` | undefined OK |
| `@MinLength(n)` | string min uzunluk |
| `@MaxLength(n)` | string max uzunluk |
| `@Min(n)` | number min |
| `@Max(n)` | number max |
| `@Matches(/regex/)` | regex match |
| `@IsStrongPassword()` | password kompleksitesi |
| `@ValidateNested()` | nested obje validate |
| `@ValidateIf(cond)` | koşullu validation |

## Global ValidationPipe

main.ts'te zorunlu:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,               // Decorator'sız field'ları sil
  forbidNonWhitelisted: true,    // Extra field varsa reddet (400)
  transform: true,                // DTO instance'ına otomatik dönüştür
  transformOptions: {
    enableImplicitConversion: true,
  },
}));
```

Bu olmadan class-validator çalışmaz — hepsi boşa.
