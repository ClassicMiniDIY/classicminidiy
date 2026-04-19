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
      [BREADCRUMB_VERSIONS.PROFILE]: { label: t('profile'), href: '/dashboard' },
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
  <div class="breadcrumbs text-base">
    <ul>
      <li v-for="(crumb, i) in breadcrumbItems" :key="i">
        <NuxtLink v-if="crumb.to" :to="crumb.to" class="text-primary hover:text-primary/80 inline-flex items-center gap-1">
          <i v-if="crumb.icon === 'i-fa6-solid-house'" class="fas fa-house"></i>
          {{ crumb.label }}
        </NuxtLink>
        <span v-else class="text-base-content/60 font-medium inline-flex items-center gap-1">
          <i v-if="crumb.icon === 'i-fa6-solid-house'" class="fas fa-house"></i>
          {{ crumb.label }}
        </span>
      </li>
    </ul>
  </div>
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
