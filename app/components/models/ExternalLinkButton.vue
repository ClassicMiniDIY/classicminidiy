<script setup lang="ts">
  /**
   * The brand-colored "View on {Site}" outbound CTA that replaces the download
   * button on external listings. The anchor points at the REAL source URL
   * (rel="nofollow sponsored noopener", new tab) so the page stays SEO-clean;
   * a sendBeacon to the visit route records the outbound click server-side, and
   * a distinct PostHog event keeps external clicks out of first-party download
   * analytics.
   */
  import { sourceConfig, type ExternalSourceSite } from '~~/data/models/external-sources';

  const props = withDefaults(
    defineProps<{
      externalModelId: string;
      slug: string;
      sourceUrl: string;
      site: ExternalSourceSite;
      block?: boolean;
      size?: 'md' | 'lg';
    }>(),
    { block: true, size: 'lg' }
  );

  const { t } = useI18n();
  const { track } = useAnalytics();
  const cfg = computed(() => sourceConfig(props.site));

  function onVisit() {
    try {
      navigator.sendBeacon?.(`/api/models/external/${props.externalModelId}/visit`);
    } catch {
      // Beacon is best-effort; the navigation still proceeds.
    }
    track('external_model_outbound_click', { source_site: props.site, slug: props.slug });
  }
</script>

<template>
  <a
    :href="sourceUrl"
    target="_blank"
    rel="nofollow sponsored noopener"
    class="btn border-0 gap-2"
    :class="[block ? 'btn-block' : '', size === 'lg' ? 'btn-lg' : '']"
    :style="{ backgroundColor: cfg.brandColor, color: cfg.textColor }"
    @click="onVisit"
    @auxclick="onVisit"
  >
    <i class="fas fa-arrow-up-right-from-square"></i>
    {{ t('viewOn', { site: cfg.label }) }}
  </a>
</template>

<i18n lang="json">
{
  "en": { "viewOn": "View on {site}" },
  "es": { "viewOn": "Ver en {site}" },
  "fr": { "viewOn": "Voir sur {site}" },
  "de": { "viewOn": "Auf {site} ansehen" },
  "it": { "viewOn": "Vedi su {site}" },
  "pt": { "viewOn": "Ver no {site}" },
  "ru": { "viewOn": "Открыть на {site}" },
  "ja": { "viewOn": "{site} で見る" },
  "zh": { "viewOn": "在 {site} 查看" },
  "ko": { "viewOn": "{site}에서 보기" }
}
</i18n>
