import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { IngestController } from './ingest.controller';
import { IngestionService } from './ingestion.service';

@Module({
  controllers: [IngestController],
  providers: [IngestionService, ApiKeyGuard],
})
export class IngestionModule {}
