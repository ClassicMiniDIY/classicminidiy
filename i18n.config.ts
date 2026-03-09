/// <reference path="./.nuxt/imports.d.ts" />

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  globalInjection: true,
  messages: {
    en: {},
    es: {},
    fr: {},
    it: {},
    de: {},
    pt: {},
    ru: {},
    ja: {},
    zh: {},
    ko: {},
  },
}));
