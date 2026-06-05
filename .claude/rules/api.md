---
globs: "src/**/*.controller.ts,src/**/controllers/**"
severity: must
---

# API / Controller Kuralları

Bu kurallar `src/**/*.controller.ts` ve `src/**/controllers/**` dosyalarına otomatik aktif olur.

## MUST

- Her controller method `@ApiOperation({ summary: '...' })` taşır (Swagger)
- Her response için `@ApiResponse({ status: ..., type: ... })` var
- `@Controller('path')` lowercase kebab-case
- Body validation `@Body() dto: SomeDto` ile — unknown body bypass yok
- Query parameter `@Query() query: SomeDto` ile — raw destructuring yok
- Auth: `@UseGuards(JwtAuthGuard)` VEYA `@Public()` — biri mutlaka
- Mutating endpoint (POST/PUT/PATCH/DELETE) her birinde `@Throttle(limit, ttl)` var
- Response shape tutarlı: `{ data, meta? }` success, `{ statusCode, message, code }` error
- HTTP status code doğru: 200 OK (GET), 201 Created (POST), 204 No Content (DELETE)
- Error yakalama: typed exception (NotFoundException, UnauthorizedException) — generic `Error` yok

## SHOULD

- URL resource-oriented: `/users`, `/users/:id/orders` (verb'ler yerine noun)
- Pagination query: `page`, `pageSize` veya `cursor`, `limit`
- Sort query: `sort=field` (asc), `sort=-field` (desc)
- Filter query: `filter[status]=active` (square bracket notation)
- Async metod her zaman `Promise<SomeType>` döner (imza)
- Response DTO ayrı (request DTO'dan) — response şeması farklı olmalı

## MAY

- Versiyonlama header'da veya URI prefix (`/v1/users`) — team kararı
- Partial response: `?fields=id,email,name`
- HATEOAS linkler (çoğu projede gereksiz, Google API gibi büyükte yararlı)

## Örnekler

### İyi
```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiTags('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @Throttle(10, 60)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.service.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
```

### Kötü
```typescript
@Controller('Users')  // ❌ lowercase değil
export class UsersController {
  @Post()             // ❌ @Throttle yok, @ApiOperation yok
  async create(@Body() body: any) {  // ❌ any type, DTO yok
    // ❌ guard yok
    if (!body.email) throw new Error('fail');  // ❌ generic Error
    return { ok: true };  // ❌ response shape belirsiz
  }
}
```

## Post-write hook etkileşimi

Bu kurallar `post-write-check.sh`'tan kontrol edilir:
- `@Throttle` yoksa warning
- `@UseGuards` yoksa warning
- `console.log` varsa warning + error-log
- DTO'suz body varsa uyarı
