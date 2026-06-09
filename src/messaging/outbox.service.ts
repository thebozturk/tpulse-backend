import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OutboxEventType } from './events';

/** Outbox pattern (docs/04): event'i DB'ye yaz; dispatcher cron'u BullMQ'ya taşır. */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Outbox satırını yazar. `tx` verilirse o transaction içinde çalışır — böylece
   * domain yazımı (ör. transfer create) ile event enqueue AYNI commit'te olur:
   * ya ikisi de yazılır ya hiçbiri (at-least-once garantisi korunur).
   */
  async enqueue(
    eventType: OutboxEventType,
    payload: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const data = {
      eventType,
      routingKey: eventType,
      payload: JSON.stringify(payload),
      retryCount: 0,
    };
    if (tx) {
      await tx.outboxMessage.create({ data });
    } else {
      await this.prisma.outboxMessage.create({ data });
    }
  }
}
