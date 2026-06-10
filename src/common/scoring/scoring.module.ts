import { Module } from '@nestjs/common';
import { HotScoreService } from './hot-score.service';

/**
 * hotScore hesaplama servisi. PrismaModule (@Global) ve ConfigModule (isGlobal)
 * sayesinde ekstra import gerektirmez. Engagement işleyen modüller
 * (messaging, posts) bu modülü import ederek HotScoreService'i kullanır.
 */
@Module({
  providers: [HotScoreService],
  exports: [HotScoreService],
})
export class ScoringModule {}
