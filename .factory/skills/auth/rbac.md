---
name: auth-rbac
keywords: "RBAC, role, permission, authorization, roles, access control"
description: "Role-based access control"
---

# RBAC (Role-Based Access Control)

## Temel model

```
User → Role(s) → Permission(s)
```

### Roller
```typescript
export enum Role {
  USER = 'user',
  EDITOR = 'editor',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}
```

### Permissions (granular)
```typescript
export enum Permission {
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  ORDER_READ = 'order:read',
  ORDER_REFUND = 'order:refund',
  CONFIG_WRITE = 'config:write',
}
```

### Mapping
```typescript
export const RolePermissions: Record<Role, Permission[]> = {
  [Role.USER]: [],
  [Role.EDITOR]: [Permission.USER_READ, Permission.ORDER_READ],
  [Role.ADMIN]: [
    Permission.USER_READ, Permission.USER_WRITE,
    Permission.ORDER_READ, Permission.ORDER_REFUND,
  ],
  [Role.SUPER_ADMIN]: Object.values(Permission),  // hepsi
};
```

## Decorator + Guard

### `@Roles` decorator
```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### RolesGuard
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required?.length) return true;  // decorator yoksa izin ver

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.roles) throw new ForbiddenException('No roles assigned');

    const hasRole = required.some(r => user.roles.includes(r));
    if (!hasRole) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
```

### Kullanım
```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  @Get('stats')
  stats() { ... }

  @Delete('users/:id')
  @Roles(Role.SUPER_ADMIN)  // method-level daha strict
  delete() { ... }
}
```

## Permission-based guard (daha granular)

```typescript
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<Permission[]>(PERMISSIONS_KEY, ctx.getHandler());
    if (!required) return true;

    const user = ctx.switchToHttp().getRequest().user;
    const userPermissions = user.roles.flatMap(r => RolePermissions[r] || []);

    const hasAll = required.every(p => userPermissions.includes(p));
    if (!hasAll) throw new ForbiddenException();
    return true;
  }
}

// Kullanım
@Delete('users/:id')
@RequirePermissions(Permission.USER_DELETE)
async delete() { ... }
```

## Resource-level authorization (ABAC)

"User kendi order'ını görebilir, başkasınınkini görmez":
```typescript
@Get(':id')
async findOne(@Param('id') id: string, @CurrentUser() user: User) {
  const order = await this.orderModel.findById(id);
  if (!order) throw new NotFoundException();

  // Ownership check
  if (order.userId.toString() !== user._id && !user.roles.includes(Role.ADMIN)) {
    throw new ForbiddenException('Not your order');
  }

  return order;
}
```

Veya custom guard:
```typescript
@Injectable()
export class OwnershipGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const order = await this.orderService.findById(req.params.id);

    if (req.user.roles.includes(Role.ADMIN)) return true;
    if (order?.userId.toString() !== req.user._id) {
      throw new ForbiddenException();
    }
    return true;
  }
}
```

## Schema

```typescript
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({
    type: [String],
    enum: Object.values(Role),
    default: [Role.USER],
  })
  roles: Role[];
}
```

Birden fazla role atanabilir. User + admin olabilir aynı anda.

## Global guard

```typescript
// app.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

Her endpoint default auth ister, `@Public()` ile bypass edilir.

## Role hierarchy

```typescript
const hierarchy: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.EDITOR]: 2,
  [Role.ADMIN]: 3,
  [Role.SUPER_ADMIN]: 4,
};

function hasRoleOrHigher(userRoles: Role[], required: Role): boolean {
  const userMax = Math.max(...userRoles.map(r => hierarchy[r] || 0));
  return userMax >= hierarchy[required];
}
```

Complicated. Permission-based daha esnek.

## Role assignment logging

Admin bir user'a role verdiğinde audit:
```typescript
async assignRole(actorId: string, targetId: string, role: Role) {
  await userModel.updateOne({ _id: targetId }, { $addToSet: { roles: role } });
  await auditService.log(actorId, 'role.assign', targetId, { role });
}
```

Audit collection forever — forensic için.

## Anti-pattern'ler

### isAdmin boolean
```typescript
@Prop() isAdmin: boolean;  // ❌ gelecekte role eklemek zor
```
Array tercih.

### Hardcoded check
```typescript
if (user.email === 'admin@acme.com') { ... }  // ❌
```

### Decorator skip
```typescript
// ❌ Guard'a karar bıraktın ama decorator kullanmadın
@Get()
async index() {
  if (user.role !== 'admin') throw new ForbiddenException();  // inline
}
```
Declarative (decorator) > imperative (inline check).

### Database'den role refetch her guard'da
```typescript
// ❌
canActivate() {
  const user = await this.userModel.findById(req.user._id);  // DB call
  // ...
}
```
JWT payload'ında role'ü taşı. DB hit olmasın.

### Trust client role
```typescript
// ❌ role'ü request body'den al
if (req.body.role === 'admin') ...
```
Role server-side (token/session'dan).

## Aksiyon

1. Enum ile Role tanımla (sabit string yerine)
2. Permission (granular) opsiyonel — başta role yeterli
3. `@Roles()` decorator + `RolesGuard`
4. JWT payload'ında roles taşı
5. Ownership check: controller veya custom guard
6. Role assignment audit log
7. Global guard: JWT + Roles varsayılan
