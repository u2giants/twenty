import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  EMAIL_REROUTER_CRON_PATTERN,
  EmailRerouterCronJob,
} from 'src/modules/pop-creations/crons/jobs/email-rerouter.cron.job';
import {
  CLICKUP_SYNC_CRON_PATTERN,
  ClickUpSyncCronJob,
} from 'src/modules/pop-creations/crons/jobs/clickup-sync.cron.job';
import {
  EMAIL_CONTACT_SYNC_CRON_PATTERN,
  EmailContactSyncCronJob,
} from 'src/modules/pop-creations/crons/jobs/email-contact-sync.cron.job';

// ─── Email Rerouter ────────────────────────────────────────────────────────

@Command({
  name: 'cron:pop-creations:email-rerouter',
  description: 'Re-routes unrouted emails every 6 hours',
})
export class EmailRerouterCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: EmailRerouterCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: EMAIL_REROUTER_CRON_PATTERN,
        },
      },
    });
  }
}

// ─── ClickUp Sync ──────────────────────────────────────────────────────────

@Command({
  name: 'cron:pop-creations:clickup-sync',
  description: 'Daily ClickUp status sync',
})
export class ClickUpSyncCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: ClickUpSyncCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: CLICKUP_SYNC_CRON_PATTERN,
        },
      },
    });
  }
}

// ─── Email Contact Sync ────────────────────────────────────────────────────

@Command({
  name: 'cron:pop-creations:email-contact-sync',
  description: 'Daily email-to-contact sync',
})
export class EmailContactSyncCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: EmailContactSyncCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: EMAIL_CONTACT_SYNC_CRON_PATTERN,
        },
      },
    });
  }
}
