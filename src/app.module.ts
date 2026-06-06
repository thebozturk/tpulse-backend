import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { configuration } from './config/configuration';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { LeaguesModule } from './leagues/leagues.module';
import { NewsModule } from './news/news.module';
import { PlayersModule } from './players/players.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
    // Global rate limit: 300/dk/IP (docs/04). Route'lar @Throttle ile sıkı
    // policy (auth 30/dk, write 120/dk) override eder.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    RedisModule,
    EmailModule,
    AuthModule,
    UsersModule,
    LeaguesModule,
    TeamsModule,
    PlayersModule,
    NewsModule,
    HealthModule,
  ],
  providers: [
    // Sıra: throttle önce (brute-force), sonra auth. JwtAuthGuard @Public bypass'lı.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
