import { Module } from '@nestjs/common';

import { ContactAutoScopeListener } from './listeners/contact-auto-scope.listener';

@Module({
  providers: [ContactAutoScopeListener],
  exports: [ContactAutoScopeListener],
})
export class ContactAutoScopeModule {}
