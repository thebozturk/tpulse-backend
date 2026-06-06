import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Endpoint'i JwtAuthGuard'tan muaf tutar (login, register, health, public okuma). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
