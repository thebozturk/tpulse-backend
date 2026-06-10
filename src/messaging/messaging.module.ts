import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScoringModule } from '../common/scoring/scoring.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OUTBOX_QUEUE } from './events';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxService } from './outbox.service';
import { ReactionProcessor } from './reaction.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
    NotificationsModule,
    ScoringModule,
  ],
  providers: [OutboxService, OutboxDispatcher, ReactionProcessor],
  exports: [OutboxService],
})
export class MessagingModule {}
