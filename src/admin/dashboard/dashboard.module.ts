import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Back office dashboard modülü. PrismaModule + RedisModule @Global olduğundan
 * ek import gerekmez; global JwtAuthGuard + RolesGuard koruması controller'da.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
