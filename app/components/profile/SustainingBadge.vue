<script lang="ts" setup>
  const { t } = useI18n();

  withDefaults(
    defineProps<{
      size?: 'sm' | 'md';
    }>(),
    { size: 'md' }
  );
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-semibold rounded-full bg-warning/20 text-warning"
    :class="size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'"
  >
    <i class="fas fa-star" :class="size === 'sm' ? 'text-[10px]' : 'text-xs'"></i>
    {{ t('label') }}
  </span>
</template>

<i18n lang="json">
{
  "en": {
    "label": "Sustaining Member"
  },
  "es": {
    "label": "Miembro Sostenedor"
  },
  "fr": {
    "label": "Membre Soutien"
  },
  "de": {
    "label": "Fördermitglied"
  },
  "it": {
    "label": "Membro Sostenitore"
  },
  "pt": {
    "label": "Membro Sustentador"
  },
  "ru": {
    "label": "Поддерживающий участник"
  },
  "ja": {
    "label": "サポーティングメンバー"
  },
  "zh": {
    "label": "持续会员"
  },
  "ko": {
    "label": "후원 회원"
  }
}
</i18n>
