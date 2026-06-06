import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BROADCAST_BATCH_SIZE,
  BROADCAST_QUEUE,
  BroadcastJobData,
} from './broadcast.constants';

/**
 * Broadcast'i batch halinde işler: Active kullanıcıları sayfalayarak gezer,
 * her batch için Notification.createMany (skipDuplicates) üretir. sentCount artar,
 * status Sending→Done/Failed. Senkron tek seferde binlerce kayıt üretilmez.
 */
@Processor(BROADCAST_QUEUE)
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BroadcastJobData>): Promise<void> {
    const { broadcastId } = job.data;
    const message = await this.prisma.broadcastMessage.findUnique({
      where: { id: broadcastId },
    });
    if (!message || message.status === 'Done') {
      return;
    }

    await this.prisma.broadcastMessage.update({
      where: { id: broadcastId },
      data: { status: 'Sending' },
    });

    try {
      let cursor: string | undefined;
      let sent = 0;
      for (;;) {
        const users = await this.prisma.user.findMany({
          where: { status: UserStatus.Active },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BROADCAST_BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (users.length === 0) {
          break;
        }
        const result = await this.prisma.notification.createMany({
          data: users.map((u) => ({
            userId: u.id,
            eventType: NotificationEventType.Announcement,
            title: message.title,
            body: message.body,
          })),
          skipDuplicates: true,
        });
        sent += result.count;
        cursor = users[users.length - 1].id;
        if (users.length < BROADCAST_BATCH_SIZE) {
          break;
        }
      }

      await this.prisma.broadcastMessage.update({
        where: { id: broadcastId },
        data: { status: 'Done', sentCount: sent },
      });
      this.logger.log(`Broadcast tamamlandı: ${broadcastId} (${sent} kayıt)`);
    } catch (err) {
      await this.prisma.broadcastMessage.update({
        where: { id: broadcastId },
        data: { status: 'Failed' },
      });
      this.logger.error(`Broadcast başarısız: ${broadcastId} — ${String(err)}`);
      throw err;
    }
  }
}
