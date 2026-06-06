import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OUTBOX_QUEUE } from './events';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxService } from './outbox.service';
import { ReactionProcessor } from './reaction.processor';

@Module({
  imports: [BullModule.registerQueue({ name: OUTBOX_QUEUE })],
  providers: [OutboxService, OutboxDispatcher, ReactionProcessor],
  exports: [OutboxService],
})
export class MessagingModule {}
