import { Module } from '@nestjs/common';

import { ProgramStageChangeListener } from './listeners/program-stage-change.listener';

@Module({
  providers: [ProgramStageChangeListener],
  exports: [ProgramStageChangeListener],
})
export class ProgramStageChangeModule {}
