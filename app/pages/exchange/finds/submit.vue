<template>
  <ExchangeFindsFindSubmitForm />
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });
</script>

<i18n lang="json">
{
  "en": { "seo": { "title": "Submit a Find — The Mini Exchange | Classic Mini DIY" } },
  "es": { "seo": { "title": "Enviar un hallazgo — The Mini Exchange | Classic Mini DIY" } },
  "fr": { "seo": { "title": "Proposer une trouvaille — The Mini Exchange | Classic Mini DIY" } },
  "de": { "seo": { "title": "Einen Fund einreichen — The Mini Exchange | Classic Mini DIY" } },
  "it": { "seo": { "title": "Segnala una scoperta — The Mini Exchange | Classic Mini DIY" } },
  "pt": { "seo": { "title": "Enviar um achado — The Mini Exchange | Classic Mini DIY" } },
  "ru": { "seo": { "title": "Предложить находку — The Mini Exchange | Classic Mini DIY" } },
  "ja": { "seo": { "title": "発見を投稿 — The Mini Exchange | Classic Mini DIY" } },
  "zh": { "seo": { "title": "提交发现 — The Mini Exchange | Classic Mini DIY" } },
  "ko": { "seo": { "title": "발견 제보 — The Mini Exchange | Classic Mini DIY" } }
}
</i18n>
