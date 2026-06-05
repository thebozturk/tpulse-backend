---
globs: "src/**/*.guard.ts,src/**/guards/**"
severity: must
---

# Guard Kuralları

`src/**/*.guard.ts` ve `src/**/guards/**` dosyalarında aktif.

## MUST

- `implements CanActivate` — interface zorunlu
- `canActivate(context: ExecutionContext): boolean | Promise<boolean>` imza
- `@Injectable()` decorator
- Constructor injection (Reflector, service'ler)
- Unauthorized durumda `throw new UnauthorizedException()` (false dönmek de olur ama mesaj yok)
- Forbidden (auth OK ama yetki yok) → `throw new ForbiddenException()`

## SHOULD

- Guard'lar single responsibility: bir guard bir şey kontrol eder
- RolesGuard ayrı, JwtAuthGuard ayrı — birleştirme
- Metadata için Reflector kullan (`@Roles('admin')` gibi custom decorator)
- Guard context'ten request'i alıp token/cookie/header inspect eder

## ASLA

- Guard'da business logic çalıştırma (DB'yi yaratma, external API)
- Guard'da side effect (log harici)
- Silent `return false` — neden başarısız olduğunu expression ile belirt
- Guard içinde response nesnesini manipüle etme (response.redirect vs.)
- Auth flow guard'ı ile RBAC guard'ı tek class'ta birleştirme

## Örnekler

### JWT Auth Guard
```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.substring(7);
  }
}
```

### Roles Guard (RBAC)
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.roles) throw new ForbiddenException('No role assigned');
    const hasRole = requiredRoles.some((r) => user.roles.includes(r));
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

### Custom decorator'lar
```typescript
// decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Kullanım
@Get()
@Public()
async publicEndpoint() { ... }

@Post()
@Roles('admin', 'editor')
async adminOnly() { ... }
```

## Guard composition

Birden fazla guard sıralı çalışır (sırayla, ilk reddederse dur):

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post()
async create() { ... }
```

Global guard:
```typescript
// main.ts veya app.module.ts
app.useGlobalGuards(new JwtAuthGuard(...));
```

## Post-write hook etkileşimi

- Guard'da `console.*` → uyarı + error-log
- Guard'da `throw new Error(...)` → uyarı (UnauthorizedException/ForbiddenException kullan)
- Reflector olmadan metadata okuma → uyarı
