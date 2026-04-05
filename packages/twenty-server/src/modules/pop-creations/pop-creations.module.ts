import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';

import { EmailRouterService } from 'src/modules/pop-creations/services/email-router.service';
import { FirefliesWebhookController } from 'src/modules/pop-creations/controllers/fireflies-webhook.controller';
import { PopCreationsRecordListener } from 'src/modules/pop-creations/listeners/pop-creations-record.listener';

// Cron jobs
import { OutlookIngestCronJob } from 'src/modules/pop-creations/crons/jobs/outlook-ingest.cron.job';
import { OutlookIngestCronCommand } from 'src/modules/pop-creations/crons/commands/outlook-ingest.cron.command';
import { EmailRerouterCronJob } from 'src/modules/pop-creations/crons/jobs/email-rerouter.cron.job';
import { ClickUpSyncCronJob } from 'src/modules/pop-creations/crons/jobs/clickup-sync.cron.job';
import { EmailContactSyncCronJob } from 'src/modules/pop-creations/crons/jobs/email-contact-sync.cron.job';
import {
  EmailRerouterCronCommand,
  ClickUpSyncCronCommand,
  EmailContactSyncCronCommand,
} from 'src/modules/pop-creations/crons/commands/pop-creations-cron.commands';

// Query hooks
import {
  CompanyFindManyEnrichCountsPostQueryHook,
  CompanyFindOneEnrichCountsPostQueryHook,
} from 'src/modules/pop-creations/query-hooks/company-enrich-counts.post-query.hook';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    GlobalWorkspaceDataSourceModule,
  ],
  controllers: [FirefliesWebhookController],
  providers: [
    // Services
    EmailRouterService,

    // Listeners
    PopCreationsRecordListener,

    // Query hooks
    CompanyFindManyEnrichCountsPostQueryHook,
    CompanyFindOneEnrichCountsPostQueryHook,

    // Cron jobs
    OutlookIngestCronJob,
    EmailRerouterCronJob,
    ClickUpSyncCronJob,
    EmailContactSyncCronJob,

    // Cron commands
    OutlookIngestCronCommand,
    EmailRerouterCronCommand,
    ClickUpSyncCronCommand,
    EmailContactSyncCronCommand,
  ],
  exports: [EmailRouterService],
})
export class PopCreationsModule {}
