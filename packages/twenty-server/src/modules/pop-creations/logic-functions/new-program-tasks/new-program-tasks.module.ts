import { Module } from '@nestjs/common';

import { NewProgramTasksListener } from './listeners/new-program-tasks.listener';

@Module({
  providers: [NewProgramTasksListener],
  exports: [NewProgramTasksListener],
})
export class NewProgramTasksModule {}
