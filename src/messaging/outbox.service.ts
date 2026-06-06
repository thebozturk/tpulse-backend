import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OutboxEventType } from './events';

/** Outbox pattern (docs/04): event'i DB'ye yaz; dispatcher cron'u BullMQ'ya taşır. */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(eventType: OutboxEventType, payload: unknown): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventType,
        routingKey: eventType,
        payload: JSON.stringify(payload),
        retryCount: 0,
      },
    });
  }
}
