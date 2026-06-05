---
name: nestjs-guards-interceptors
keywords: "guard, interceptor, canActivate, intercept, rxjs, middleware, pipe"
description: "Guard, interceptor, pipe, middleware execution order ve kullanımı"
---

# Guards, Interceptors, Pipes, Middleware

## Execution sırası (tek request için)

```
Request geldi
  ↓
1. Middleware (Express-level, route matching öncesi)
  ↓
2. Guards (auth, RBAC)
  ↓
3. Interceptors (before) — logging, metrics başlangıç
  ↓
4. Pipes (validation, transform)
  ↓
5. Controller method
  ↓
6. Interceptors (after) — response transform, logging bitiş
  ↓
7. Exception filters (hata varsa)
  ↓
Response
```

## Guard — "Giriş izin?"

`implements CanActivate`. True/false veya exception throw. Kullanım: auth, RBAC.

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    // verify...
    return true;
  }
}
```

Apply:
```typescript
@UseGuards(JwtAuthGuard)  // controller veya method
```

Global:
```typescript
// main.ts
app.useGlobalGuards(new JwtAuthGuard(...));
// veya app.module.ts
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

## Interceptor — "Before/After + response transform"

`implements NestInterceptor`. RxJS stream manipülasyonu.

### Logging interceptor
```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const now = Date.now();
    const requestId = randomUUID();
    req.requestId = requestId;

    this.logger.log(`[${requestId}] ${req.method} ${req.url}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`[${requestId}] completed in ${duration}ms`);
      }),
    );
  }
}
```

### Response transform (wrap with `{ data }`)
```typescript
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({ data, meta: { timestamp: new Date().toISOString() } })),
    );
  }
}
```

### Timeout interceptor
```typescript
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
```

## Pipe — "Input validation + transform"

`implements PipeTransform`. Input'u valide/dönüştür.

### ValidationPipe (built-in)
Zaten global kurulu (bkz. config rule):
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

### Parse pipe
```typescript
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string) { ... }

@Get()
async findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) { ... }
```

### Custom pipe
```typescript
@Injectable()
export class ObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ObjectId');
    }
    return new Types.ObjectId(value);
  }
}

// Kullanım
@Get(':id')
async findOne(@Param('id', ObjectIdPipe) id: Types.ObjectId) { ... }
```

## Middleware — "Pre-route Express-level"

Route match etmeden önce çalışır. Genelde gereksiz — guard/interceptor yeter. Ama gerekli olduğu yer: global request ID, CORS özel durumu.

```typescript
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req['requestId'] = randomUUID();
  res.setHeader('X-Request-ID', req['requestId']);
  next();
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
```

## Anti-pattern'ler

### Guard'da business logic
```typescript
// KÖTÜ
canActivate(ctx): boolean {
  const user = getUserFromToken(token);
  this.auditService.log(`User ${user.id} accessed`);  // side effect guard'da
  if (user.subscription === 'expired') {
    this.emailService.sendReminder(user);  // daha beter
  }
  return true;
}
```
Guard sadece "izin var mı" der. Log/email interceptor'a veya service'e.

### Interceptor'da auth
```typescript
// KÖTÜ
intercept(ctx, next) {
  const user = verifyToken(...);  // bu guard'ın işi
  if (!user) throw new UnauthorizedException();
  return next.handle();
}
```

### Pipe'ta DB sorgusu
```typescript
// KÖTÜ
transform(value) {
  const user = await this.userRepo.findById(value);  // pipe'ta DB?
  return user;
}
```
Pipe şekil dönüşümü için. DB'ye erişim service katmanında.

## Aksiyon

- Auth → Guard
- Logging, metrics, response transform → Interceptor
- Input validation, parse → Pipe
- Pre-route bir şey (request ID) → Middleware
- Exception handling → Exception Filter
