import { Module } from '@nestjs/common';

import { EmailRerouterScheduler } from './services/email-rerouter.scheduler';
import { EmailRerouterService } from './services/email-rerouter.service';

@Module({
  providers: [EmailRerouterService, EmailRerouterScheduler],
  exports: [EmailRerouterService],
})
export class EmailRerouterModule {}
