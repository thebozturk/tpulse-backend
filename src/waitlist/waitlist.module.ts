import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LaunchProcessor } from './launch.processor';
import { LAUNCH_QUEUE } from './waitlist.constants';
import { WaitlistAdminController } from './waitlist.admin.controller';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [BullModule.registerQueue({ name: LAUNCH_QUEUE })],
  controllers: [WaitlistController, WaitlistAdminController],
  providers: [WaitlistService, LaunchProcessor],
})
export class WaitlistModule {}
