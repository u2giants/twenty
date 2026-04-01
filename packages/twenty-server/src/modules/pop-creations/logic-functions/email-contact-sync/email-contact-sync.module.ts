import { Module } from '@nestjs/common';

import { EmailContactSyncScheduler } from './services/email-contact-sync.scheduler';
import { EmailContactSyncService } from './services/email-contact-sync.service';

@Module({
  providers: [EmailContactSyncService, EmailContactSyncScheduler],
  exports: [EmailContactSyncService],
})
export class EmailContactSyncModule {}
