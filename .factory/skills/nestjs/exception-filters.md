---
name: nestjs-exception-filters
keywords: "exception, filter, HttpException, catch, error handler, global"
description: "Global exception handling, typed exceptions, consistent error response"
---

# Exception Filters

## Built-in HTTP exceptions

```typescript
throw new BadRequestException('Invalid input');        // 400
throw new UnauthorizedException();                      // 401
throw new ForbiddenException('Insufficient permissions'); // 403
throw new NotFoundException('User not found');          // 404
throw new ConflictException('Email already exists');    // 409
throw new UnprocessableEntityException();               // 422
throw new InternalServerErrorException();               // 500
throw new BadGatewayException('Upstream failed');       // 502
throw new ServiceUnavailableException();                // 503
throw new RequestTimeoutException();                    // 408
```

Tüm'ü `HttpException`'dan türer.

## Custom exception

```typescript
export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super({
      statusCode: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email already registered',
      // email'i expose etme (enumeration attack)
    });
  }
}
```

## Global exception filter

```typescript
import { Catch, ArgumentsHost, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object') {
        code = (res as any).code || HttpStatus[status] || 'ERROR';
        message = (res as any).message || exception.message;
        details = (res as any).errors;
      } else {
        message = res;
      }
    } else if (exception instanceof Error) {
      // Bilinmeyen hata — detayları sadece log'a, response'a değil
      this.logger.error(exception.message, exception.stack);
    }

    // Development'ta stack trace OK; production'da asla
    const isDev = process.env.NODE_ENV !== 'production';

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details && { details }),
      ...(isDev && exception instanceof Error && { stack: exception.stack }),
      requestId: (request as any).requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

Register:
```typescript
// main.ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

## Her şeyi HttpException'a çevirme

Service'ten pure business logic error throw etmek → controller/interceptor catch eder ve HttpException'a çevirir:

```typescript
// service
export class PaymentDeclinedError extends Error {
  constructor(public readonly reason: string) { super(`Payment declined: ${reason}`); }
}

// global filter mapping
@Catch(PaymentDeclinedError)
export class PaymentDeclinedFilter implements ExceptionFilter {
  catch(exception: PaymentDeclinedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(402).json({
      statusCode: 402,
      code: 'PAYMENT_DECLINED',
      message: exception.reason,
    });
  }
}
```

## Error code katalogu

Frontend'in kullanacağı stable kod'lar. Snake_case:

```typescript
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

Frontend bu kodlara göre UI mesajı gösterir (i18n destekli).

## Anti-pattern'ler

### Stack trace production'da
```typescript
// KÖTÜ
response.json({ error: exception.stack });  // internal bilgi sızıntısı
```

### PII leak
```typescript
// KÖTÜ
throw new NotFoundException(`User ${email} not found`);  // email enumeration
// İYİ
throw new NotFoundException('User not found');
```

### Generic `Error`
```typescript
// KÖTÜ
throw new Error('fail');  // 500 dönecek, mesaj typed değil

// İYİ
throw new BadRequestException({ code: 'INVALID', message: 'bad input' });
```

### Filter'da DB yazma
```typescript
// KÖTÜ — filter side effect'siz olmalı
catch(exception, host) {
  await this.db.save(exception);  // burada DB yazma
}
```
Audit log için interceptor veya event emitter kullan.

## Aksiyon

1. main.ts'te global `GlobalExceptionFilter` kurulu
2. Controller'da typed exception throw (`NotFoundException`, etc.)
3. Service'ten özel error class'lar — filter'da map'lenir
4. Error code katalogu paylaşılır — frontend kullanır
5. Production'da stack trace ASLA response'a gitmez (log'a gider)
6. PII içermesin error mesajı (email enumeration önlemi)
