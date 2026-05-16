<script setup lang="ts">
  interface Props {
    to: string;
    icon: string;
    title: string;
    description: string;
    /** Short tag shown bottom-left (e.g. "Calculator", "Decoder", "Reference"). */
    kind?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    kind: '',
  });

  const { t } = useI18n({
    useScope: 'global',
    messages: {
      en: { open: 'Open' },
      es: { open: 'Abrir' },
      fr: { open: 'Ouvrir' },
      de: { open: 'Öffnen' },
      it: { open: 'Apri' },
      pt: { open: 'Abrir' },
      ru: { open: 'Открыть' },
      ja: { open: '開く' },
      zh: { open: '打开' },
      ko: { open: '열기' },
    },
  });

  const isExternal = computed(() => props.to.startsWith('http'));
</script>

<template>
  <NuxtLink
    :to="to"
    :target="isExternal ? '_blank' : undefined"
    :external="isExternal || undefined"
    class="tool-card"
  >
    <span class="tool-card__icn">
      <i :class="['fad', icon]" aria-hidden="true"></i>
    </span>
    <h4 class="tool-card__title">{{ title }}</h4>
    <p class="tool-card__desc">{{ description }}</p>
    <div class="tool-card__footer">
      <span v-if="kind">{{ kind }}</span>
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
    background: color-mix(in srgb, var(--cm-primary) 14%, transparent);
    color: var(--cm-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }
  .tool-card__icn i {
    --fa-primary-color: var(--cm-primary);
    --fa-secondary-color: var(--cm-secondary);
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
  .tool-card__go {
    color: var(--cm-secondary);
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    font-size: 0.8125rem;
  }
</style>
