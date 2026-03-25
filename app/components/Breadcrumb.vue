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
    const sectionMap: Record<string, { label: string; href: string }> = {
      [BREADCRUMB_VERSIONS.TECH]: { label: t('technical'), href: '/technical' },
      [BREADCRUMB_VERSIONS.ADMIN]: { label: t('admin'), href: '/admin' },
      [BREADCRUMB_VERSIONS.PROFILE]: { label: t('profile'), href: '/profile' },
      [BREADCRUMB_VERSIONS.ARCHIVE]: { label: t('archive'), href: '/archive' },
    };

    const section = sectionMap[props.version] || sectionMap[BREADCRUMB_VERSIONS.ARCHIVE];
    const sectionLabel = section.label;
    const sectionHref = section.href;

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
    "admin": "Admin",
    "profile": "Dashboard"
  },
  "de": {
    "home": "Startseite",
    "archive": "Archiv",
    "technical": "Technisch",
    "admin": "Verwaltung",
    "profile": "Dashboard"
  },
  "es": {
    "home": "Inicio",
    "archive": "Archivo",
    "technical": "Técnico",
    "admin": "Administración",
    "profile": "Panel"
  },
  "fr": {
    "home": "Accueil",
    "archive": "Archive",
    "technical": "Technique",
    "admin": "Administration",
    "profile": "Tableau de bord"
  },
  "it": {
    "home": "Casa",
    "archive": "Archivio",
    "technical": "Tecnico",
    "admin": "Amministrazione",
    "profile": "Dashboard"
  },
  "ja": {
    "home": "ホーム",
    "archive": "アーカイブ",
    "technical": "技術",
    "admin": "管理",
    "profile": "ダッシュボード"
  },
  "ko": {
    "home": "홈",
    "archive": "아카이브",
    "technical": "기술 정보",
    "admin": "관리",
    "profile": "대시보드"
  },
  "pt": {
    "home": "Início",
    "archive": "Arquivo",
    "technical": "Técnico",
    "admin": "Administração",
    "profile": "Painel"
  },
  "ru": {
    "home": "Главная",
    "archive": "Архив",
    "technical": "Техническая",
    "admin": "Администрирование",
    "profile": "Панель"
  },
  "zh": {
    "home": "主页",
    "archive": "档案库",
    "technical": "技术",
    "admin": "管理",
    "profile": "仪表盘"
  }
}
</i18n>
