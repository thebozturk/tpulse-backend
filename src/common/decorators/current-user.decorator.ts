import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** JwtStrategy'nin request.user'a koyduğu kimlik bilgisi (Faz 2'de doldurulur). */
export interface AuthUser {
  userId: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Controller'da oturum kullanıcısına erişim: @CurrentUser() user: AuthUser.
 * Alan istenirse: @CurrentUser('userId') userId: string.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    return data ? user?.[data] : user;
  },
);
