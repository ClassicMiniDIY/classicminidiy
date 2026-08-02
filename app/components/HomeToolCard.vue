<script setup lang="ts">
  interface Props {
    to: string;
    icon: string;
    title: string;
    description: string;
    /** Short tag shown bottom-left (e.g. "Calculator", "Decoder", "Reference"). */
    kind?: string;
    /**
     * Replaces the kind tag with an olive "Archive data" marker on tools whose
     * data the community actually feeds (design S4). Only set it where a
     * contribution genuinely improves the tool — it is a promise, not a badge.
     */
    archiveBacked?: boolean;
    /** Duotone primary color (matches the tool's icon in /technical). */
    iconPrimary?: string;
    /** Duotone secondary color. Defaults to iconPrimary (monochrome look). */
    iconSecondary?: string;
    /** Secondary opacity 0–1. */
    iconSecondaryOpacity?: number | string;
  }

  const props = withDefaults(defineProps<Props>(), {
    kind: '',
    archiveBacked: false,
    iconPrimary: undefined,
    iconSecondary: undefined,
    iconSecondaryOpacity: 1,
  });

  // The icn surface tints to match the icon's primary color so each card
  // reads as visually unified — falls back to the olive brand primary.
  const iconStyle = computed(() => {
    const primary = props.iconPrimary ?? 'var(--cm-primary)';
    const secondary = props.iconSecondary ?? props.iconPrimary ?? 'var(--cm-secondary)';
    return {
      '--fa-primary-color': primary,
      '--fa-secondary-color': secondary,
      '--fa-secondary-opacity': String(props.iconSecondaryOpacity),
    } as Record<string, string>;
  });

  // Tint the icn surface 14% of the primary so the card reads coherently.
  const surfaceStyle = computed(() => {
    if (!props.iconPrimary) return {};
    return {
      backgroundColor: `color-mix(in srgb, ${props.iconPrimary} 14%, transparent)`,
      color: props.iconPrimary,
    };
  });

  const { t } = useI18n({
    useScope: 'global',
    messages: {
      en: { open: 'Open', archive_data: 'Archive data' },
      es: { open: 'Abrir', archive_data: 'Datos del archivo' },
      fr: { open: 'Ouvrir', archive_data: 'Données des archives' },
      de: { open: 'Öffnen', archive_data: 'Archivdaten' },
      it: { open: 'Apri', archive_data: "Dati dell'archivio" },
      pt: { open: 'Abrir', archive_data: 'Dados do arquivo' },
      ru: { open: 'Открыть', archive_data: 'Данные архива' },
      ja: { open: '開く', archive_data: 'アーカイブ由来' },
      zh: { open: '打开', archive_data: '档案数据' },
      ko: { open: '열기', archive_data: '아카이브 데이터' },
    },
  });

  const isExternal = computed(() => props.to.startsWith('http'));

  const { track } = useAnalytics();
</script>

<template>
  <NuxtLink
    :to="to"
    :target="isExternal ? '_blank' : undefined"
    :external="isExternal || undefined"
    class="tool-card"
    @click="track('tool_card_clicked', { tool_name: title, location: 'home' })"
  >
    <span class="tool-card__icn" :style="surfaceStyle">
      <i :class="['fad', icon]" :style="iconStyle" aria-hidden="true"></i>
    </span>
    <h4 class="tool-card__title">{{ title }}</h4>
    <p class="tool-card__desc">{{ description }}</p>
    <div class="tool-card__footer">
      <span v-if="archiveBacked" class="tool-card__archive">
        <i class="fas fa-book" aria-hidden="true"></i> {{ t('archive_data') }}
      </span>
      <span v-else-if="kind">{{ kind }}</span>
      <span class="tool-card__go">{{ t('open') }} →</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
  .tool-card {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 0.75rem;
    padding: 1.125rem;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    color: var(--fg-1);
    text-decoration: none;
    cursor: pointer;
    transition: transform var(--t-base) var(--ease-out), box-shadow var(--t-base) var(--ease-out);
  }
  .tool-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    text-decoration: none;
  }

  .tool-card__icn {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.6rem;
    /* Default surface (overridable inline per-card). */
    background: color-mix(in srgb, var(--cm-primary) 14%, transparent);
    color: var(--cm-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }

  .tool-card__title {
    margin: 0.25rem 0 0.125rem;
    font-size: 1rem;
    font-weight: 700;
    line-height: var(--lh-snug);
  }
  .tool-card__desc {
    margin: 0;
    color: var(--fg-2);
    font-size: 0.8125rem;
    line-height: 1.45;
  }
  .tool-card__footer {
    margin-top: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--fg-3);
    text-transform: uppercase;
    letter-spacing: var(--tracking-caps);
    font-weight: 600;
  }
  .tool-card__archive {
    color: var(--cm-accent);
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    font-size: 0.75rem;
  }
  .tool-card__go {
    color: var(--cm-secondary);
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    font-size: 0.8125rem;
  }
</style>
