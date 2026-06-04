import { i18n } from '@lingui/core';

export const dynamicActivate = async (_locale?: string) => {
  const { messages } = await import('../../locales/generated/en.ts');
  i18n.load('en', messages);
  i18n.activate('en');
};
