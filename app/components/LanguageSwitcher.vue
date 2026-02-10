<script setup lang="ts">
  const { t, locale, locales, setLocale } = useI18n();
  const switchLocalePath = useSwitchLocalePath();

  const currentLocale = computed(() => {
    return locales.value.find((i) => i.code === locale.value);
  });

  const availableLocales = computed(() => {
    return locales.value.filter((i) => i.code !== locale.value);
  });

  const { capture } = usePostHog();

  const handleLanguageChange = async (localeCode: string) => {
    capture('language_changed', {
      from_language: locale.value,
      to_language: localeCode,
    });

    // Set the locale which will persist in cookie/localStorage
    await setLocale(localeCode as any);

    // Navigate to the new locale path
    await navigateTo(switchLocalePath(localeCode as any));
  };

  // Function to close dropdown on mobile
  const closeDropdown = () => {
    const activeElement = document.activeElement;
    if (activeElement && 'blur' in activeElement) {
      (activeElement as any).blur();
    }
  };

  // Language names in their native languages for better UX
  const getLanguageName = (localeCode: string): string => {
    const nativeNames: Record<string, string> = {
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
    return nativeNames[localeCode] || localeCode;
  };
</script>

<template>
  <UDropdownMenu
    :items="
      availableLocales.map((loc) => ({
        label: getLanguageName(loc.code),
        onSelect: () => handleLanguageChange(loc.code),
      }))
    "
    :aria-label="t('language_menu_aria')"
  >
    <UButton
      variant="ghost"
      size="sm"
      class="w-20"
      :aria-label="t('language_button_aria')"
      :title="t('language_button_title')"
    >
      <i class="fad fa-globe shrink-0"></i>
      <span class="text-xs font-medium">{{ currentLocale?.code?.toUpperCase() || 'EN' }}</span>
      <i class="fad fa-chevron-down text-xs shrink-0"></i>
    </UButton>
  </UDropdownMenu>
</template>

<i18n lang="json">
{
  "en": {
    "language_button_aria": "Select language",
    "language_button_title": "Change language",
    "language_menu_aria": "Language selection menu",
    "switch_to_language": "Switch to {language}"
  },
  "de": {
    "language_button_aria": "Sprache auswählen",
    "language_button_title": "Sprache ändern",
    "language_menu_aria": "Sprachauswahlmenü",
    "switch_to_language": "Wechseln zu {language}"
  },
  "es": {
    "language_button_aria": "Seleccionar idioma",
    "language_button_title": "Cambiar idioma",
    "language_menu_aria": "Menú de selección de idioma",
    "switch_to_language": "Cambiar a {language}"
  },
  "fr": {
    "language_button_aria": "Sélectionner la langue",
    "language_button_title": "Changer de langue",
    "language_menu_aria": "Menu de sélection de langue",
    "switch_to_language": "Passer à {language}"
  },
  "it": {
    "language_button_aria": "Seleziona lingua",
    "language_button_title": "Cambia lingua",
    "language_menu_aria": "Menu di selezione lingua",
    "switch_to_language": "Passa a {language}"
  },
  "pt": {
    "language_button_aria": "Selecionar idioma",
    "language_button_title": "Alterar idioma",
    "language_menu_aria": "Menu de seleção de idioma",
    "switch_to_language": "Mudar para {language}"
  },
  "ru": {
    "language_button_aria": "Выбрать язык",
    "language_button_title": "Изменить язык",
    "language_menu_aria": "Меню выбора языка",
    "switch_to_language": "Переключиться на {language}"
  },
  "ja": {
    "language_button_aria": "言語を選択",
    "language_button_title": "言語を変更",
    "language_menu_aria": "言語選択メニュー",
    "switch_to_language": "{language}に切り替え"
  },
  "zh": {
    "language_button_aria": "选择语言",
    "language_button_title": "更改语言",
    "language_menu_aria": "语言选择菜单",
    "switch_to_language": "切换到{language}"
  },
  "ko": {
    "language_button_aria": "언어 선택",
    "language_button_title": "언어 변경",
    "language_menu_aria": "언어 선택 메뉴",
    "switch_to_language": "{language}로 전환"
  }
}
</i18n>
