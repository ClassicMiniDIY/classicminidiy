<template>
  <span class="badge badge-warning gap-1" :class="sizeClass">
    <i class="fas fa-star" :class="iconClass"></i>
    <span v-if="size === 'md'">{{ t('sustainingMember') }}</span>
    <span v-else>{{ t('sustaining') }}</span>
  </span>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      size?: 'sm' | 'md';
    }>(),
    {
      size: 'sm',
    }
  );

  const sizeClass = computed(() => (props.size === 'md' ? 'badge-md' : 'badge-sm'));
  const iconClass = computed(() => (props.size === 'md' ? 'text-sm' : 'text-xs'));
</script>

<i18n lang="json">
{
  "en": { "sustainingMember": "Sustaining Member", "sustaining": "Sustaining" },
  "es": { "sustainingMember": "Miembro de apoyo", "sustaining": "Apoyo" },
  "fr": { "sustainingMember": "Membre de soutien", "sustaining": "Soutien" },
  "de": { "sustainingMember": "Fördermitglied", "sustaining": "Förderer" },
  "it": { "sustainingMember": "Membro sostenitore", "sustaining": "Sostenitore" },
  "pt": { "sustainingMember": "Membro de apoio", "sustaining": "Apoio" },
  "ru": { "sustainingMember": "Постоянный участник", "sustaining": "Постоянный" },
  "ja": { "sustainingMember": "サステイニングメンバー", "sustaining": "サステイニング" },
  "zh": { "sustainingMember": "持续会员", "sustaining": "持续" },
  "ko": { "sustainingMember": "후원 회원", "sustaining": "후원" }
}
</i18n>
