<template>
  <ExchangeListingsBulkUploader />
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useHead({
    title: t('seo.title'),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<i18n lang="json">
{
  "en": { "seo": { "title": "Bulk Upload Listings — The Mini Exchange | Classic Mini DIY" } },
  "es": { "seo": { "title": "Subida masiva de anuncios — The Mini Exchange | Classic Mini DIY" } },
  "fr": { "seo": { "title": "Import groupé d'annonces — The Mini Exchange | Classic Mini DIY" } },
  "de": { "seo": { "title": "Anzeigen im Stapel hochladen — The Mini Exchange | Classic Mini DIY" } },
  "it": { "seo": { "title": "Caricamento massivo annunci — The Mini Exchange | Classic Mini DIY" } },
  "pt": { "seo": { "title": "Envio em massa de anúncios — The Mini Exchange | Classic Mini DIY" } },
  "ru": { "seo": { "title": "Массовая загрузка объявлений — The Mini Exchange | Classic Mini DIY" } },
  "ja": { "seo": { "title": "出品の一括アップロード — The Mini Exchange | Classic Mini DIY" } },
  "zh": { "seo": { "title": "批量上传刊登 — The Mini Exchange | Classic Mini DIY" } },
  "ko": { "seo": { "title": "매물 일괄 업로드 — The Mini Exchange | Classic Mini DIY" } }
}
</i18n>
