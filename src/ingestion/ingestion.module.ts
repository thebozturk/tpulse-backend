import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { MessagingModule } from '../messaging/messaging.module';
import { NewsModule } from '../news/news.module';
import { TransfersModule } from '../transfers/transfers.module';
import { IngestController } from './ingest.controller';
import { IngestProjectionService } from './ingest-projection.service';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [TransfersModule, NewsModule, MessagingModule],
  controllers: [IngestController],
  providers: [IngestionService, IngestProjectionService, ApiKeyGuard],
})
export class IngestionModule {}
