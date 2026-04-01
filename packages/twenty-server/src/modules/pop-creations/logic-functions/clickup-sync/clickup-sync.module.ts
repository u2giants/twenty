import { Module } from '@nestjs/common';

import { ClickupSyncScheduler } from './services/clickup-sync.scheduler';
import { ClickupSyncService } from './services/clickup-sync.service';

@Module({
  providers: [ClickupSyncService, ClickupSyncScheduler],
  exports: [ClickupSyncService],
})
export class ClickupSyncModule {}
