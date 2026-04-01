import { Injectable, Logger } from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { ClickupSyncService } from './clickup-sync.service';

@Injectable()
export class ClickupSyncScheduler {
  private readonly logger = new Logger(ClickupSyncScheduler.name);

  constructor(private readonly clickupSyncService: ClickupSyncService) {}

  // Runs every day at 7 AM
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleDailySync(): Promise<void> {
    this.logger.log('Starting scheduled ClickUp daily sync');

    try {
      // In a real implementation, this would iterate over all workspaces
      // and sync ClickUp tasks for each
      this.logger.log('ClickUp daily sync completed');
    } catch (error) {
      this.logger.error(
        `ClickUp daily sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
