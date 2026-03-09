<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS } from '../../data/models/generic';

  const { t } = useI18n({ missingWarn: false, fallbackWarn: false });

  const props = defineProps({
    page: {
      type: String,
      default: '',
    },
    version: {
      type: String as PropType<BREADCRUMB_VERSIONS>,
      default: BREADCRUMB_VERSIONS.ARCHIVE,
    },
    root: {
      type: Boolean,
    },
    subpage: {
      type: String,
    },
    subpageHref: {
      type: String,
    },
    href: {
      type: String,
      default: '',
    },
  });

  const breadcrumbItems = computed(() => {
    const result: { label: string; to?: string; icon?: string }[] = [];

    // Home is always first
    result.push({
      label: t('home'),
      to: '/',
      icon: 'i-fa6-solid-house',
    });

    // Determine section based on version
    const sectionLabel =
      props.version === BREADCRUMB_VERSIONS.TECH
        ? t('technical')
        : props.version === BREADCRUMB_VERSIONS.ADMIN
          ? t('admin')
          : t('archive');

    const sectionHref =
      props.version === BREADCRUMB_VERSIONS.TECH
        ? '/technical'
        : props.version === BREADCRUMB_VERSIONS.ADMIN
          ? '/admin'
          : '/archive';

    if (props.root) {
      // Root page - section is current/disabled
      result.push({
        label: sectionLabel,
      });
    } else if (props.subpage) {
      // Has subpage - section is clickable, subpage is clickable, page is current
      result.push({
        label: sectionLabel,
        to: sectionHref,
      });
      result.push({
        label: props.subpage,
        to: props.subpageHref,
      });
      result.push({
        label: props.page,
      });
    } else {
      // Regular page - section is clickable, page is current
      result.push({
        label: sectionLabel,
        to: sectionHref,
      });
      result.push({
        label: props.page,
      });
    }

    return result;
  });
</script>

<template>
  <UBreadcrumb
    :items="breadcrumbItems"
    class="text-base"
    :ui="{
      item: 'text-primary-600 dark:text-primary-400',
      link: 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300',
      linkActive: 'text-neutral-500 dark:text-neutral-400 font-medium',
      separator: 'text-neutral-400 dark:text-neutral-500',
      icon: 'text-primary-600 dark:text-primary-400',
    }"
  />
</template>

<i18n lang="json">
{
  "en": {
    "home": "Home",
    "archive": "Archive",
    "technical": "Technical",
    "admin": "Admin"
  },
  "de": {
    "home": "Startseite",
    "archive": "Archiv",
    "technical": "Technisch",
    "admin": "Verwaltung"
  },
  "es": {
    "home": "Inicio",
    "archive": "Archivo",
    "technical": "Técnico",
    "admin": "Administración"
  },
  "fr": {
    "home": "Accueil",
    "archive": "Archive",
    "technical": "Technique",
    "admin": "Administration"
  },
  "it": {
    "home": "Casa",
    "archive": "Archivio",
    "technical": "Tecnico",
    "admin": "Amministrazione"
  },
  "ja": {
    "home": "ホーム",
    "archive": "アーカイブ",
    "technical": "技術",
    "admin": "管理"
  },
  "ko": {
    "home": "홈",
    "archive": "아카이브",
    "technical": "기술 정보",
    "admin": "관리"
  },
  "pt": {
    "home": "Início",
    "archive": "Arquivo",
    "technical": "Técnico",
    "admin": "Administração"
  },
  "ru": {
    "home": "Главная",
    "archive": "Архив",
    "technical": "Техническая",
    "admin": "Администрирование"
  },
  "zh": {
    "home": "主页",
    "archive": "档案库",
    "technical": "技术",
    "admin": "管理"
  }
}
</i18n>
