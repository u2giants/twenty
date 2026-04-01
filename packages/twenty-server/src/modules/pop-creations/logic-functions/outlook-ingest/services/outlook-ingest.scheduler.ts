import { Injectable, Logger } from '@nestjs/common';

import { Interval } from '@nestjs/schedule';

import { OutlookIngestService } from './outlook-ingest.service';

@Injectable()
export class OutlookIngestScheduler {
  private readonly logger = new Logger(OutlookIngestScheduler.name);

  constructor(private readonly outlookIngestService: OutlookIngestService) {}

  // Runs every 15 minutes
  @Interval(15 * 60 * 1000) // 15 minutes in milliseconds
  async handleInterval(): Promise<void> {
    this.logger.log('Starting scheduled Outlook email ingestion');

    try {
      // In a real implementation, this would iterate over all workspaces
      // and ingest emails for each
      this.logger.log('Outlook email ingestion completed');
    } catch (error) {
      this.logger.error(
        `Outlook email ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
