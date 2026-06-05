// Template: Guard
// Kullanım: src/common/guards/<name>.guard.ts

import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class XxxGuard implements CanActivate {
  private readonly logger = new Logger(XxxGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public route mı?
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });

    try {
      const payload = await this.jwtService.verifyAsync(token);
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
    }
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.substring(7);
  }
}
