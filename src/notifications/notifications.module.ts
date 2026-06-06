import { Module } from '@nestjs/common';
import { MeNotificationPreferencesController } from './me-notification-preferences.controller';
import { MeNotificationsController } from './me-notifications.controller';
import { NOTIFICATION_REPOSITORY } from './notification.repository';
import { NotificationsService } from './notifications.service';
import { PrismaNotificationRepository } from './prisma-notification.repository';

@Module({
  controllers: [MeNotificationsController, MeNotificationPreferencesController],
  providers: [
    NotificationsService,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
