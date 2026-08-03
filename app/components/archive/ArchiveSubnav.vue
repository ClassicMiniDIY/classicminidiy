<script lang="ts" setup>
  /**
   * The Archive's row-2 section bar.
   *
   * Rendered on the archive home AND on every archive section page, which is a
   * deliberate departure from the design's "landing pages only" rule. The rule
   * made sense when the bar listed four sections; with all seven it is the
   * archive's table of contents, and its actual job — "I'm in Wheels, take me to
   * Electrical" — only happens on the section pages. On the home page the
   * category grid does that job, so there the bar is a shortcut; on a section
   * page it is the only way across without going back.
   *
   * These links navigate to real routes rather than filtering in place like the
   * Toolbox bar does, because archive sections are genuinely separate pages with
   * different data shapes. The active state is what keeps that from feeling like
   * being thrown out of the section.
   */
  import { ARCHIVE_SECTIONS } from '../../../data/models/toolbox-catalog';

  defineProps<{
    /** Which section is current. Omit on the archive home. */
    activeKey?: string;
  }>();

  const { t } = useI18n();
  const { track } = useAnalytics();
  const { openWizard } = useContributeWizard();

  const links = ARCHIVE_SECTIONS.map((section) => ({
    key: section.key,
    label: t(`sections.${section.key}`),
    to: section.to,
  }));

  const contribute = () => {
    track('contribute_cta_clicked', { type: 'archive', location: 'archive_subnav' });
    openWizard({ origin: 'archive_subnav' });
  };
</script>

<template>
  <SectionSubnav
    :label="t('label')"
    :links="links"
    :active-key="activeKey"
    :action-label="t('contribute')"
    action-icon="fas fa-paper-plane"
    @action="contribute()"
  />
</template>

<i18n lang="json">
{
  "en": {
    "label": "ARCHIVE",
    "contribute": "Contribute",
    "sections": {
      "registry": "Registry",
      "documents": "Documents",
      "wheels": "Wheels",
      "colors": "Colours",
      "electrical": "Electrical",
      "engines": "Engines",
      "weights": "Weights"
    }
  },
  "es": {
    "label": "ARCHIVO",
    "contribute": "Contribuir",
    "sections": {
      "registry": "Registro",
      "documents": "Documentos",
      "wheels": "Ruedas",
      "colors": "Colores",
      "electrical": "Eléctricos",
      "engines": "Motores",
      "weights": "Pesos"
    }
  },
  "fr": {
    "label": "ARCHIVE",
    "contribute": "Contribuer",
    "sections": {
      "registry": "Registre",
      "documents": "Documents",
      "wheels": "Jantes",
      "colors": "Couleurs",
      "electrical": "Électricité",
      "engines": "Moteurs",
      "weights": "Poids"
    }
  },
  "de": {
    "label": "ARCHIV",
    "contribute": "Beitragen",
    "sections": {
      "registry": "Register",
      "documents": "Dokumente",
      "wheels": "Räder",
      "colors": "Farben",
      "electrical": "Elektrik",
      "engines": "Motoren",
      "weights": "Gewichte"
    }
  },
  "it": {
    "label": "ARCHIVIO",
    "contribute": "Contribuisci",
    "sections": {
      "registry": "Registro",
      "documents": "Documenti",
      "wheels": "Cerchi",
      "colors": "Colori",
      "electrical": "Impianto elettrico",
      "engines": "Motori",
      "weights": "Pesi"
    }
  },
  "pt": {
    "label": "ARQUIVO",
    "contribute": "Contribuir",
    "sections": {
      "registry": "Registo",
      "documents": "Documentos",
      "wheels": "Jantes",
      "colors": "Cores",
      "electrical": "Elétrico",
      "engines": "Motores",
      "weights": "Pesos"
    }
  },
  "ru": {
    "label": "АРХИВ",
    "contribute": "Внести вклад",
    "sections": {
      "registry": "Реестр",
      "documents": "Документы",
      "wheels": "Диски",
      "colors": "Цвета",
      "electrical": "Электрика",
      "engines": "Двигатели",
      "weights": "Массы"
    }
  },
  "ja": {
    "label": "アーカイブ",
    "contribute": "貢献する",
    "sections": {
      "registry": "レジストリ",
      "documents": "資料",
      "wheels": "ホイール",
      "colors": "カラー",
      "electrical": "電装",
      "engines": "エンジン",
      "weights": "重量"
    }
  },
  "zh": {
    "label": "档案馆",
    "contribute": "贡献",
    "sections": {
      "registry": "注册库",
      "documents": "文档",
      "wheels": "轮毂",
      "colors": "颜色",
      "electrical": "电路",
      "engines": "发动机",
      "weights": "重量"
    }
  },
  "ko": {
    "label": "아카이브",
    "contribute": "기여하기",
    "sections": {
      "registry": "레지스트리",
      "documents": "문서",
      "wheels": "휠",
      "colors": "색상",
      "electrical": "전기",
      "engines": "엔진",
      "weights": "중량"
    }
  }
}
</i18n>
