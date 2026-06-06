import { Global, Module } from '@nestjs/common';
import { UserStatusCache } from './user-status.cache';

/**
 * UserStatusCache'i global olarak sağlar: hem global APP_GUARD (JwtAuthGuard) hem de
 * BO-2 user-management servisleri aynı cache'e erişir.
 * PrismaModule + RedisModule @Global olduğundan ek import gerekmez.
 */
@Global()
@Module({
  providers: [UserStatusCache],
  exports: [UserStatusCache],
})
export class UserStatusModule {}
