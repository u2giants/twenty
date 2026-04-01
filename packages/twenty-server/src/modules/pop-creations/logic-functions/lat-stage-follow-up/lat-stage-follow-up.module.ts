import { Module } from '@nestjs/common';

import { LatStageFollowUpListener } from './listeners/lat-stage-follow-up.listener';

@Module({
  providers: [LatStageFollowUpListener],
  exports: [LatStageFollowUpListener],
})
export class LatStageFollowUpModule {}
