import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { firstValueFrom, isObservable } from 'rxjs';
import { UserStatusCache } from '../auth/user-status.cache';
import { AuthUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * passport-jwt tabanlı global auth guard. @Public() ile işaretli endpoint'leri bypass eder.
 *
 * BO-1: JWT doğrulandıktan sonra kullanıcının durumu (UserStatus) kontrol edilir —
 * Banned/Suspended/Inactive ise access token geçerli olsa bile 403 döner. Durum
 * Redis read-through cache'ten okunur (UserStatusCache), DB her istekte dövülmez.
 * OptionalJwtAuthGuard bu guard'ı extend etmez; public okuma uçları etkilenmez.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly statusCache: UserStatusCache,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const result = super.canActivate(context);
    const authorized = isObservable(result)
      ? await firstValueFrom(result)
      : await result;
    if (!authorized) {
      return false;
    }

    await this.assertActive(context);
    return true;
  }

  /** Banlı/suspend/inactive kullanıcı, JWT'si geçerli olsa da engellenir. */
  private async assertActive(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const userId = request.user?.userId;
    // Kullanıcı yoksa (token doğru ama kayıt yoksa) mevcut davranış korunur — geçer.
    if (!userId) {
      return;
    }

    const status = await this.statusCache.getStatus(userId);
    if (status === null || status === UserStatus.Active) {
      return;
    }
    switch (status) {
      case UserStatus.Banned:
        throw new ForbiddenException('Hesabınız banlandı');
      case UserStatus.Suspended:
        throw new ForbiddenException('Hesabınız askıya alındı');
      default:
        throw new ForbiddenException('Hesabınız aktif değil');
    }
  }
}
