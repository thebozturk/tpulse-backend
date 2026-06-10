import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  LAUNCH_BATCH_SIZE,
  LAUNCH_QUEUE,
  LaunchJobData,
  SEND_DELAY_MS,
} from './waitlist.constants';

/**
 * Lansman kampanyasını batch halinde işler: subscribed + henüz gönderilmemiş
 * aboneleri cursor ile sayfalayarak gezer, her birine sıralı e-posta gönderir.
 * Gönderilen abone `launchEmailSentAt` ile işaretlenir → tekrar tetikleme veya
 * yeniden deneme yalnızca kalanları işler (idempotent + resume).
 * Tek alıcı hatası toplu gönderimi durdurmaz (loglanır, atlanır).
 */
@Processor(LAUNCH_QUEUE)
export class LaunchProcessor extends WorkerHost {
  private readonly logger = new Logger(LaunchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job<LaunchJobData>): Promise<void> {
    const { campaignId } = job.data;
    const campaign = await this.prisma.launchCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.status === 'Done') {
      return;
    }

    await this.prisma.launchCampaign.update({
      where: { id: campaignId },
      data: { status: 'Sending' },
    });

    try {
      let sent = 0;
      for (;;) {
        // cursor yerine "henüz gönderilmemiş ilk N" — gönderilenler işaretlenince
        // sorgudan düşer, sonsuz döngü olmaz.
        const subscribers = await this.prisma.waitlistSubscriber.findMany({
          where: { status: 'subscribed', launchEmailSentAt: null },
          select: { id: true, email: true },
          orderBy: { id: 'asc' },
          take: LAUNCH_BATCH_SIZE,
        });
        if (subscribers.length === 0) {
          break;
        }

        for (const sub of subscribers) {
          try {
            // İçerik backend'de sabit (launch.content.ts) — kampanya yalnızca
            // tetikleyici. Her aboneye aynı lansman template'i gider.
            await this.email.sendLaunch(sub.email);
            await this.prisma.waitlistSubscriber.update({
              where: { id: sub.id },
              data: { launchEmailSentAt: new Date() },
            });
            sent += 1;
          } catch (err) {
            this.logger.warn(
              `Lansman maili başarısız (atlandı): ${sub.email} — ${String(err)}`,
            );
          }
          await delay(SEND_DELAY_MS);
        }

        await this.prisma.launchCampaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: sent } },
        });
        sent = 0;
      }

      await this.prisma.launchCampaign.update({
        where: { id: campaignId },
        data: { status: 'Done' },
      });
      this.logger.log(`Lansman kampanyası tamamlandı: ${campaignId}`);
    } catch (err) {
      await this.prisma.launchCampaign.update({
        where: { id: campaignId },
        data: { status: 'Failed' },
      });
      this.logger.error(
        `Lansman kampanyası başarısız: ${campaignId} — ${String(err)}`,
      );
      throw err;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
