<script setup lang="ts">
  import type { ModelLicenseInfo } from '~~/data/models/model-library';

  const props = withDefaults(
    defineProps<{
      license: ModelLicenseInfo;
      /** Compact mode hides the derived permission chips (used on cards). */
      compact?: boolean;
    }>(),
    { compact: false }
  );

  const { t } = useI18n();

  interface Chip {
    label: string;
    icon: string;
    tone: 'success' | 'warning' | 'neutral' | 'error';
  }

  const chips = computed<Chip[]>(() => {
    const l = props.license;
    const out: Chip[] = [];
    out.push(
      l.allowsCommercialUse
        ? { label: t('chips.commercialOk'), icon: 'fa-store', tone: 'success' }
        : { label: t('chips.nonCommercial'), icon: 'fa-ban', tone: 'warning' }
    );
    out.push(
      l.allowsDerivatives
        ? { label: t('chips.remixOk'), icon: 'fa-code-branch', tone: 'success' }
        : { label: t('chips.noDerivatives'), icon: 'fa-lock', tone: 'warning' }
    );
    if (l.requiresAttribution) out.push({ label: t('chips.attribution'), icon: 'fa-user-pen', tone: 'neutral' });
    if (l.requiresShareAlike) out.push({ label: t('chips.shareAlike'), icon: 'fa-arrows-rotate', tone: 'neutral' });
    if (!l.allowsFileRedistribution)
      out.push({ label: t('chips.noFileSharing'), icon: 'fa-file-circle-xmark', tone: 'error' });
    return out;
  });

  const viewFullLicense = computed(() => t('viewFullLicense', { name: props.license.name }));

  const toneClass: Record<Chip['tone'], string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    neutral: 'badge-neutral',
    error: 'badge-error',
  };
</script>

<template>
  <div class="flex flex-wrap items-start gap-2">
    <a
      v-if="license.url"
      :href="license.url"
      target="_blank"
      rel="noopener noreferrer"
      class="badge badge-lg h-auto min-h-8 items-start gap-1.5 whitespace-normal py-1.5 text-left leading-snug"
      :class="license.isPaid ? 'badge-primary' : 'badge-outline'"
      :title="viewFullLicense"
    >
      <i class="fas mt-0.5 shrink-0" :class="license.isPaid ? 'fa-tag' : 'fa-scale-balanced'"></i>
      {{ license.name }}
    </a>
    <span
      v-else
      class="badge badge-lg h-auto min-h-8 items-start gap-1.5 whitespace-normal py-1.5 text-left leading-snug"
      :class="license.isPaid ? 'badge-primary' : 'badge-outline'"
    >
      <i class="fas mt-0.5 shrink-0" :class="license.isPaid ? 'fa-tag' : 'fa-scale-balanced'"></i>
      {{ license.name }}
    </span>

    <template v-if="!compact">
      <span v-for="chip in chips" :key="chip.label" class="badge badge-sm gap-1" :class="toneClass[chip.tone]">
        <i class="fas text-[0.65rem]" :class="chip.icon"></i>
        {{ chip.label }}
      </span>
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "viewFullLicense": "{name} — view full license",
    "chips": {
      "commercialOk": "Commercial OK",
      "nonCommercial": "Non-commercial",
      "remixOk": "Remix OK",
      "noDerivatives": "No derivatives",
      "attribution": "Attribution",
      "shareAlike": "Share-alike",
      "noFileSharing": "No file sharing"
    }
  },
  "es": {
    "viewFullLicense": "{name} — ver licencia completa",
    "chips": {
      "commercialOk": "Uso comercial OK",
      "nonCommercial": "No comercial",
      "remixOk": "Remix permitido",
      "noDerivatives": "Sin derivados",
      "attribution": "Atribución",
      "shareAlike": "Compartir igual",
      "noFileSharing": "Sin redistribución"
    }
  },
  "fr": {
    "viewFullLicense": "{name} — voir la licence complète",
    "chips": {
      "commercialOk": "Usage commercial OK",
      "nonCommercial": "Non commercial",
      "remixOk": "Remix autorisé",
      "noDerivatives": "Pas de dérivés",
      "attribution": "Attribution",
      "shareAlike": "Partage à l'identique",
      "noFileSharing": "Pas de redistribution"
    }
  },
  "de": {
    "viewFullLicense": "{name} — vollständige Lizenz anzeigen",
    "chips": {
      "commercialOk": "Kommerziell OK",
      "nonCommercial": "Nicht kommerziell",
      "remixOk": "Remix OK",
      "noDerivatives": "Keine Ableitungen",
      "attribution": "Namensnennung",
      "shareAlike": "Weitergabe gleich",
      "noFileSharing": "Keine Weitergabe"
    }
  },
  "it": {
    "viewFullLicense": "{name} — visualizza licenza completa",
    "chips": {
      "commercialOk": "Uso commerciale OK",
      "nonCommercial": "Non commerciale",
      "remixOk": "Remix OK",
      "noDerivatives": "Nessun derivato",
      "attribution": "Attribuzione",
      "shareAlike": "Condividi allo stesso modo",
      "noFileSharing": "Nessuna redistribuzione"
    }
  },
  "pt": {
    "viewFullLicense": "{name} — ver licença completa",
    "chips": {
      "commercialOk": "Uso comercial OK",
      "nonCommercial": "Não comercial",
      "remixOk": "Remix OK",
      "noDerivatives": "Sem derivados",
      "attribution": "Atribuição",
      "shareAlike": "Compartilhar igual",
      "noFileSharing": "Sem redistribuição"
    }
  },
  "ru": {
    "viewFullLicense": "{name} — просмотреть полную лицензию",
    "chips": {
      "commercialOk": "Коммерческое использование OK",
      "nonCommercial": "Некоммерческое",
      "remixOk": "Remix разрешён",
      "noDerivatives": "Без производных",
      "attribution": "Атрибуция",
      "shareAlike": "Распространять на тех же условиях",
      "noFileSharing": "Без распространения файлов"
    }
  },
  "ja": {
    "viewFullLicense": "{name} — ライセンス全文を見る",
    "chips": {
      "commercialOk": "商用利用可",
      "nonCommercial": "非商用のみ",
      "remixOk": "改変可",
      "noDerivatives": "改変禁止",
      "attribution": "クレジット表示",
      "shareAlike": "継承",
      "noFileSharing": "ファイル再配布禁止"
    }
  },
  "zh": {
    "viewFullLicense": "{name} — 查看完整许可证",
    "chips": {
      "commercialOk": "可商业使用",
      "nonCommercial": "非商业",
      "remixOk": "可改编",
      "noDerivatives": "禁止改编",
      "attribution": "署名",
      "shareAlike": "相同方式共享",
      "noFileSharing": "禁止文件共享"
    }
  },
  "ko": {
    "viewFullLicense": "{name} — 전체 라이선스 보기",
    "chips": {
      "commercialOk": "상업적 이용 가능",
      "nonCommercial": "비상업적",
      "remixOk": "리믹스 가능",
      "noDerivatives": "2차 저작물 금지",
      "attribution": "저작자 표시",
      "shareAlike": "동일 조건 공유",
      "noFileSharing": "파일 공유 금지"
    }
  }
}
</i18n>
