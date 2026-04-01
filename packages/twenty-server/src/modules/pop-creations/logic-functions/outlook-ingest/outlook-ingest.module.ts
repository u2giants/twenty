import { Module } from '@nestjs/common';

import { OutlookIngestScheduler } from './services/outlook-ingest.scheduler';
import { OutlookIngestService } from './services/outlook-ingest.service';

@Module({
  providers: [OutlookIngestService, OutlookIngestScheduler],
  exports: [OutlookIngestService],
})
export class OutlookIngestModule {}
