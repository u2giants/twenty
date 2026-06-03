import { Injectable, Logger } from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { EmailRerouterService } from './email-rerouter.service';

@Injectable()
export class EmailRerouterScheduler {
  private readonly logger = new Logger(EmailRerouterScheduler.name);

  constructor(private readonly emailRerouterService: EmailRerouterService) {}

  // Runs every 6 hours
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron(): Promise<void> {
    this.logger.log('Starting scheduled email rerouting job');

    try {
      // In a real implementation, this would iterate over all workspaces
      // For now, this is a placeholder that would need workspace iteration
      this.logger.log('Email rerouting job completed');
    } catch (error) {
      this.logger.error(
        `Email rerouting job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
