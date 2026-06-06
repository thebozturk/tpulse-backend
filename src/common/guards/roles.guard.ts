import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RBAC guard. JwtAuthGuard'tan SONRA çalışır (request.user dolu olmalı).
 * @Roles metadata yoksa serbest bırakır; varsa kullanıcının rolünü kontrol eder.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    if (!user?.role) {
      throw new ForbiddenException('Rol atanmamış');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Yetersiz yetki');
    }
    return true;
  }
}
