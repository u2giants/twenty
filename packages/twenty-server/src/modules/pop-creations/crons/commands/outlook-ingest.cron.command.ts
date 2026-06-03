import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  OUTLOOK_INGEST_CRON_PATTERN,
  OutlookIngestCronJob,
} from 'src/modules/pop-creations/crons/jobs/outlook-ingest.cron.job';

@Command({
  name: 'cron:pop-creations:outlook-ingest',
  description: 'Polls Outlook/Microsoft Graph every 15 min, ingests emails',
})
export class OutlookIngestCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: OutlookIngestCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: OUTLOOK_INGEST_CRON_PATTERN,
        },
      },
    });
  }
}
