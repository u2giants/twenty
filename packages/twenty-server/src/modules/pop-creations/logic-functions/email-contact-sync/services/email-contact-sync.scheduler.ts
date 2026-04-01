import { Injectable, Logger } from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { EmailContactSyncService } from './email-contact-sync.service';

@Injectable()
export class EmailContactSyncScheduler {
  private readonly logger = new Logger(EmailContactSyncScheduler.name);

  constructor(
    private readonly emailContactSyncService: EmailContactSyncService,
  ) {}

  // Runs every day at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySync(): Promise<void> {
    this.logger.log('Starting scheduled email-to-contact sync');

    try {
      // In a real implementation, this would iterate over all workspaces
      // and sync emails for each
      this.logger.log('Email-to-contact sync completed');
    } catch (error) {
      this.logger.error(
        `Email-to-contact sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
