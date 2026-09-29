<script setup lang="ts">
  // The language picker. It is the only one on the site: it lives on
  // /settings/preferences (MainNav links there). `setLocale` writes the
  // `i18n_redirected` cookie, which SSR honours on the next request.
  const { locale, locales, setLocale } = useI18n({ useScope: 'global' });
  const { t } = useI18n();
  const switchLocalePath = useSwitchLocalePath();
  const { capture } = usePostHog();

  const pending = ref<string | null>(null);

  const handleLanguageChange = async (localeCode: string) => {
    if (localeCode === locale.value || pending.value) return;
    pending.value = localeCode;
    capture('language_changed', {
      from_language: locale.value,
      to_language: localeCode,
    });
    try {
      await setLocale(localeCode as any);
      await navigateTo(switchLocalePath(localeCode as any));
    } finally {
      pending.value = null;
    }
  };

  // Language names in their own language, so a reader can find theirs.
  const NATIVE_NAMES: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    ja: '日本語',
    zh: '中文',
    ko: '한국어',
  };
  const getLanguageName = (localeCode: string): string => NATIVE_NAMES[localeCode] || localeCode;
</script>

<template>
  <fieldset class="fieldset" data-testid="language-switcher">
    <legend class="fieldset-legend text-base">{{ t('title') }}</legend>
    <p class="mb-3 text-sm opacity-70">{{ t('description') }}</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <button
        v-for="loc in locales"
        :key="loc.code"
        type="button"
        class="btn btn-sm justify-start"
        :class="loc.code === locale ? 'btn-primary' : 'btn-ghost border-base-300'"
        :aria-pressed="loc.code === locale"
        :aria-label="
          loc.code === locale
            ? t('current_language', { language: getLanguageName(loc.code) })
            : t('switch_to_language', { language: getLanguageName(loc.code) })
        "
        :lang="loc.code"
        :data-testid="`language-option-${loc.code}`"
        :disabled="pending !== null"
        @click="handleLanguageChange(loc.code)"
      >
        <i v-if="pending === loc.code" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <i v-else-if="loc.code === locale" class="fas fa-check" aria-hidden="true"></i>
        {{ getLanguageName(loc.code) }}
      </button>
    </div>
  </fieldset>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Language",
    "description": "Choose the language for menus and pages on this site.",
    "switch_to_language": "Switch to {language}",
    "current_language": "Current language: {language}"
  },
  "es": {
    "title": "Idioma",
    "description": "Elige el idioma de los menús y las páginas de este sitio.",
    "switch_to_language": "Cambiar a {language}",
    "current_language": "Idioma actual: {language}"
  },
  "fr": {
    "title": "Langue",
    "description": "Choisissez la langue des menus et des pages de ce site.",
    "switch_to_language": "Passer à {language}",
    "current_language": "Langue actuelle : {language}"
  },
  "de": {
    "title": "Sprache",
    "description": "Wählen Sie die Sprache für Menüs und Seiten dieser Website.",
    "switch_to_language": "Wechseln zu {language}",
    "current_language": "Aktuelle Sprache: {language}"
  },
  "it": {
    "title": "Lingua",
    "description": "Scegli la lingua dei menu e delle pagine di questo sito.",
    "switch_to_language": "Passa a {language}",
    "current_language": "Lingua attuale: {language}"
  },
  "pt": {
    "title": "Idioma",
    "description": "Escolha o idioma dos menus e das páginas deste site.",
    "switch_to_language": "Mudar para {language}",
    "current_language": "Idioma atual: {language}"
  },
  "ru": {
    "title": "Язык",
    "description": "Выберите язык меню и страниц этого сайта.",
    "switch_to_language": "Переключиться на {language}",
    "current_language": "Текущий язык: {language}"
  },
  "ja": {
    "title": "言語",
    "description": "このサイトのメニューとページの言語を選択します。",
    "switch_to_language": "{language}に切り替え",
    "current_language": "現在の言語：{language}"
  },
  "zh": {
    "title": "语言",
    "description": "选择本网站菜单和页面的语言。",
    "switch_to_language": "切换到{language}",
    "current_language": "当前语言：{language}"
  },
  "ko": {
    "title": "언어",
    "description": "이 사이트의 메뉴와 페이지 언어를 선택하세요.",
    "switch_to_language": "{language}로 전환",
    "current_language": "현재 언어: {language}"
  }
}
</i18n>
