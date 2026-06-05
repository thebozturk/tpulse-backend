---
name: nestjs-swagger
keywords: "swagger, openapi, ApiProperty, ApiOperation, ApiResponse, export, contract"
description: "OpenAPI generation ve contract export"
---

# Swagger (OpenAPI)

## Setup

```bash
pnpm add @nestjs/swagger
```

`main.ts`:
```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Acme API')
  .setDescription('REST API for Acme platform')
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'JWT',
  )
  .addTag('auth', 'Authentication endpoints')
  .addTag('users', 'User management')
  .build();

const document = SwaggerModule.createDocument(app, config);

// Web UI (dev ortamında)
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('api/docs', app, document);
}

// Export for contract
if (process.env.EXPORT_OPENAPI === 'true') {
  const fs = await import('fs');
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  process.exit(0);
}
```

## Decorator listesi

### Controller level
```typescript
@ApiTags('users')
@ApiBearerAuth('JWT')  // Tüm endpoint'ler auth ister
@Controller('users')
```

### Method level
```typescript
@Post()
@ApiOperation({
  summary: 'Create user',
  description: 'Register a new user account. Email must be unique.',
})
@ApiResponse({ status: 201, type: UserResponseDto, description: 'User created' })
@ApiResponse({ status: 400, description: 'Validation failed' })
@ApiResponse({ status: 409, description: 'Email already exists' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
  return this.service.create(dto);
}
```

### DTO level
```typescript
export class CreateUserDto {
  @ApiProperty({
    example: 'alice@acme.com',
    description: 'User email address',
    maxLength: 255,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'secure-password-123',
    minLength: 8,
    maxLength: 72,
  })
  @IsString() @MinLength(8) @MaxLength(72)
  password: string;

  @ApiPropertyOptional({
    enum: ['user', 'admin'],
    default: 'user',
  })
  @IsOptional() @IsEnum(['user', 'admin'])
  role?: string;
}
```

### Response DTO
```typescript
export class UserResponseDto {
  @ApiProperty({ example: '65f7b3a9c1234567890abcde' })
  id: string;

  @ApiProperty({ example: 'alice@acme.com' })
  email: string;

  @ApiProperty()
  createdAt: Date;

  // password yok, refreshToken yok — response güvenli
}
```

## Advanced

### Generic wrapper
```typescript
export class PaginatedDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty()
  meta: { total: number; page: number; pageSize: number };
}

// Kullanım — @ApiExtraModels ile
@ApiExtraModels(PaginatedDto, UserResponseDto)
@ApiResponse({
  status: 200,
  schema: {
    allOf: [
      { $ref: getSchemaPath(PaginatedDto) },
      { properties: { data: { type: 'array', items: { $ref: getSchemaPath(UserResponseDto) } } } },
    ],
  },
})
async findAll() { ... }
```

### File upload
```typescript
@Post('avatar')
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
})
async upload(@UploadedFile() file: Express.Multer.File) { ... }
```

### Custom response header
```typescript
@ApiHeader({ name: 'X-Request-ID', description: 'Request trace ID' })
```

## OpenAPI export → frontend

NestJS → openapi.json → frontend types:

```bash
# Export
EXPORT_OPENAPI=true pnpm start

# Frontend'de
openapi-typescript openapi.json -o src/lib/api/types.d.ts

# Veya generated client
openapi-generator-cli generate -i openapi.json -g typescript-axios -o src/lib/api/
```

## Anti-pattern'ler

### `@ApiProperty` eksik
```typescript
// ❌ Swagger doc'a gitmez
export class CreateUserDto {
  @IsEmail()
  email: string;  // @ApiProperty yok
}
```

### Example yok
```typescript
// ❌ Frontend dev example'ı tahmin etmek zorunda
@ApiProperty()  // example yok
email: string;

// ✓
@ApiProperty({ example: 'alice@acme.com' })
email: string;
```

### Response DTO'da sensitive field
```typescript
// ❌ Swagger docs'ta password görünür, misyon bitirir
export class UserResponseDto {
  password: string;
  refreshToken: string;
}
```

### `@ApiResponse` sadece 200 için
```typescript
// ❌ Frontend hangi hata'ları bekleyeceğini bilmiyor
@ApiResponse({ status: 200, type: User })
// 400, 401, 404, 429, 500 YOK
```

## Aksiyon

1. `@ApiTags` her controller'da
2. `@ApiOperation` her method'da
3. `@ApiResponse` en az 3 status (success + 2 error)
4. `@ApiProperty` her DTO field'ında (example zorunlu)
5. Response DTO ayrı — request DTO ≠ response DTO
6. `/contract-publish` ile openapi.json yayınla
