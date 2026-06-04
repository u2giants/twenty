import { Injectable, type OnModuleInit } from '@nestjs/common';

import { type I18n, type MessageOptions, setupI18n } from '@lingui/core';
import { type APP_LOCALES } from 'twenty-shared/translations';

import { messages as enMessages } from 'src/engine/core-modules/i18n/locales/generated/en';

@Injectable()
export class I18nService implements OnModuleInit {
  private i18n: I18n = setupI18n();

  async loadTranslations() {
    this.i18n.load('en', enMessages);
    this.i18n.activate('en');
  }

  getI18nInstance(_locale?: keyof typeof APP_LOCALES) {
    return this.i18n;
  }

  translateMessage({
    messageId,
    values,
    options,
  }: {
    messageId: string;
    values?: Record<string, string>;
    locale?: keyof typeof APP_LOCALES;
    options?: MessageOptions;
  }) {
    return this.i18n._(messageId, values, options);
  }

  async onModuleInit() {
    await this.loadTranslations();
  }
}
