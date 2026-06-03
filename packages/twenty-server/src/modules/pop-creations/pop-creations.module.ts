import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

import { EmailRouterService } from 'src/modules/pop-creations/services/email-router.service';
import { SoExtractorService } from 'src/modules/pop-creations/services/so-extractor.service';
import { OpportunitySummaryService } from 'src/modules/pop-creations/services/opportunity-summary.service';
import { FirefliesWebhookController } from 'src/modules/pop-creations/controllers/fireflies-webhook.controller';
import { OpportunityChatController } from 'src/modules/pop-creations/controllers/opportunity-chat.controller';
import { PopCreationsRecordListener } from 'src/modules/pop-creations/listeners/pop-creations-record.listener';

// Automation listeners (rebuilt for v2.8 @OnDatabaseBatchEvent)
import { NewProgramTasksListener } from 'src/modules/pop-creations/logic-functions/new-program-tasks/listeners/new-program-tasks.listener';
import { ProgramStageChangeListener } from 'src/modules/pop-creations/logic-functions/program-stage-change/listeners/program-stage-change.listener';
import { LatStageFollowUpListener } from 'src/modules/pop-creations/logic-functions/lat-stage-follow-up/listeners/lat-stage-follow-up.listener';

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
    TypeOrmModule.forFeature([WorkspaceEntity, FieldMetadataEntity]),
    GlobalWorkspaceDataSourceModule,
    WorkspaceCacheModule,
  ],
  controllers: [FirefliesWebhookController, OpportunityChatController],
  providers: [
    // Services
    EmailRouterService,
    SoExtractorService,
    OpportunitySummaryService,

    // Listeners
    PopCreationsRecordListener,
    NewProgramTasksListener,
    ProgramStageChangeListener,
    LatStageFollowUpListener,

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
