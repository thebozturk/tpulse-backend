import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Token varsa request.user'a koyar, yoksa/invalidse undefined bırakır (throw etmez).
 * @Public ile birlikte kullanılır (global JwtAuthGuard'ı bypass + opsiyonel hidrasyon).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | undefined {
    return user ?? undefined;
  }

  // canActivate'i her zaman true yap (kimlik yoksa bile geç)
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // token invalid → yok say
    }
    return true;
  }
}
