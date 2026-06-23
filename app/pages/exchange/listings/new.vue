<template>
  <ExchangeListingsWizardListingWizard />
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
  "en": { "seo": { "title": "Create New Listing — The Mini Exchange | Classic Mini DIY" } },
  "es": { "seo": { "title": "Crear anuncio — The Mini Exchange | Classic Mini DIY" } },
  "fr": { "seo": { "title": "Créer une annonce — The Mini Exchange | Classic Mini DIY" } },
  "de": { "seo": { "title": "Anzeige erstellen — The Mini Exchange | Classic Mini DIY" } },
  "it": { "seo": { "title": "Crea annuncio — The Mini Exchange | Classic Mini DIY" } },
  "pt": { "seo": { "title": "Criar anúncio — The Mini Exchange | Classic Mini DIY" } },
  "ru": { "seo": { "title": "Создать объявление — The Mini Exchange | Classic Mini DIY" } },
  "ja": { "seo": { "title": "出品を作成 — The Mini Exchange | Classic Mini DIY" } },
  "zh": { "seo": { "title": "创建刊登 — The Mini Exchange | Classic Mini DIY" } },
  "ko": { "seo": { "title": "매물 등록 — The Mini Exchange | Classic Mini DIY" } }
}
</i18n>
