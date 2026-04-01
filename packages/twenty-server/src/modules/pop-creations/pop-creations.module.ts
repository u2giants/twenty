import { Module } from '@nestjs/common';

import { ClickupSyncModule } from './logic-functions/clickup-sync/clickup-sync.module';
import { ContactAutoScopeModule } from './logic-functions/contact-auto-scope/contact-auto-scope.module';
import { EmailContactSyncModule } from './logic-functions/email-contact-sync/email-contact-sync.module';
import { EmailRerouterModule } from './logic-functions/email-rerouter/email-rerouter.module';
import { FirefliesIngestModule } from './logic-functions/fireflies-ingest/fireflies-ingest.module';
import { LatStageFollowUpModule } from './logic-functions/lat-stage-follow-up/lat-stage-follow-up.module';
import { NewProgramTasksModule } from './logic-functions/new-program-tasks/new-program-tasks.module';
import { OutlookIngestModule } from './logic-functions/outlook-ingest/outlook-ingest.module';
import { PostInstallModule } from './logic-functions/post-install/post-install.module';
import { PreInstallModule } from './logic-functions/pre-install/pre-install.module';
import { ProgramStageChangeModule } from './logic-functions/program-stage-change/program-stage-change.module';

@Module({
  imports: [
    FirefliesIngestModule,
    ContactAutoScopeModule,
    LatStageFollowUpModule,
    NewProgramTasksModule,
    ProgramStageChangeModule,
    ClickupSyncModule,
    EmailRerouterModule,
    EmailContactSyncModule,
    OutlookIngestModule,
    PreInstallModule,
    PostInstallModule,
  ],
  exports: [
    FirefliesIngestModule,
    ContactAutoScopeModule,
    LatStageFollowUpModule,
    NewProgramTasksModule,
    ProgramStageChangeModule,
    ClickupSyncModule,
    EmailRerouterModule,
    EmailContactSyncModule,
    OutlookIngestModule,
    PreInstallModule,
    PostInstallModule,
  ],
})
export class PopCreationsModule {}
