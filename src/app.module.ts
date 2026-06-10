import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { LoadAwareThrottlerGuard } from './common/throttle/load-aware-throttler.guard';
import { GLOBAL_THROTTLE } from './common/throttle/throttle-policies';
import { CommentsModule } from './comments/comments.module';
import { FavouritesModule } from './favourites/favourites.module';
import { FeedModule } from './feed/feed.module';
import { FollowsModule } from './follows/follows.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { SyncModule } from './sync/sync.module';
import { TransferCommentsModule } from './transfer-comments/transfer-comments.module';
import { AuditLogsModule } from './admin/audit/audit-logs.module';
import { BroadcastModule } from './admin/broadcast/broadcast.module';
import { CurrencyRatesModule } from './admin/currency-rates/currency-rates.module';
import { DigestsModule } from './digests/digests.module';
import { DashboardModule } from './admin/dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './common/audit/audit.module';
import { UserStatusModule } from './common/auth/user-status.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { configuration } from './config/configuration';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { LeaguesModule } from './leagues/leagues.module';
import { NewsModule } from './news/news.module';
import { PlayersModule } from './players/players.module';
import { ProfileModule } from './profile/profile.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { TeamsModule } from './teams/teams.module';
import { TransfersModule } from './transfers/transfers.module';
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
    ThrottlerModule.forRoot([GLOBAL_THROTTLE]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(
          config.getOrThrow<string>('redis.connectionString'),
        );
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    UserStatusModule,
    StorageModule,
    MessagingModule,
    PostsModule,
    CommentsModule,
    TransferCommentsModule,
    FavouritesModule,
    NotificationsModule,
    SyncModule,
    EmailModule,
    AuthModule,
    UsersModule,
    TransfersModule,
    SearchModule,
    LeaguesModule,
    TeamsModule,
    PlayersModule,
    NewsModule,
    ProfileModule,
    HealthModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    AuditLogsModule,
    BroadcastModule,
    CurrencyRatesModule,
    IngestionModule,
    DigestsModule,
    FollowsModule,
    FeedModule,
  ],
  providers: [
    // Sıra: throttle önce (brute-force), sonra auth. JwtAuthGuard @Public bypass'lı.
    { provide: APP_GUARD, useClass: LoadAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Idempotency: mutating uçlarda Idempotency-Key header'ı ile tekrar koruması.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
