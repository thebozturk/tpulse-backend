import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BROADCAST_QUEUE } from './broadcast.constants';
import { BroadcastController } from './broadcast.controller';
import { BroadcastProcessor } from './broadcast.processor';
import { BroadcastService } from './broadcast.service';

@Module({
  imports: [BullModule.registerQueue({ name: BROADCAST_QUEUE })],
  controllers: [BroadcastController],
  providers: [BroadcastService, BroadcastProcessor],
})
export class BroadcastModule {}
