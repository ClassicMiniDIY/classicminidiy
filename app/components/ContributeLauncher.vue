<script lang="ts" setup>
  /**
   * Shared body for the `/contribute/{document,registry,wheel}` routes.
   *
   * Those routes used to render three ~1,000-line forms that duplicated each
   * other and the inline archive forms. They now open the one contribute wizard
   * instead — but the ROUTES stay, because `nuxt.config.ts` 301s
   * `/archive/documents/submit`, `/archive/colors/contribute` and
   * `/archive/wheels/submit` at them, and those redirects are load-bearing SEO
   * for URLs that have been linked for years.
   *
   * The card below is not a formality: the wizard is a client-side modal, so a
   * direct hit (or a JS failure) has to leave something on the page that
   * explains itself and can be clicked.
   */
  import type { ContributionKind } from '../composables/useContributeWizard';
  import type { Database } from '~~/types/database';

  const props = defineProps<{
    kind: ContributionKind;
    /** Pre-fills a gap-fill against an existing entry, from `?uuid=`. */
    targetType?: Database['public']['Enums']['target_type_enum'];
    targetId?: string | null;
    targetTitle?: string | null;
    title: string;
    description: string;
    buttonLabel: string;
  }>();

  const { t } = useI18n();
  const route = useRoute();
  const { openWizard, isOpen } = useContributeWizard();

  const launch = () =>
    openWizard({
      kind: props.kind,
      targetType: props.targetType ?? null,
      targetId: props.targetId ?? null,
      targetTitle: props.targetTitle ?? null,
      origin: route.path,
    });

  // Auto-open on arrival — someone who followed a "Submit a wheel" link wants the
  // form, not a page about the form.
  onMounted(launch);
</script>

<template>
  <div class="mx-auto w-full max-w-[680px] px-4 py-10 lg:py-14">
    <div class="card border border-base-300 bg-base-100 shadow-md">
      <div class="card-body items-center gap-3 text-center">
        <i class="fad fa-paper-plane text-3xl text-primary" aria-hidden="true"></i>
        <h1 class="text-xl font-bold">{{ title }}</h1>
        <p class="max-w-md text-sm opacity-75">{{ description }}</p>
        <button type="button" class="btn btn-secondary mt-2" @click="launch()">
          {{ isOpen ? t('reopen') : buttonLabel }}
        </button>
        <NuxtLink to="/contribute" class="mt-1 text-[13px] font-semibold text-primary hover:underline">
          {{ t('other_ways') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": { "reopen": "Reopen the form", "other_ways": "Contribute something else" },
  "es": { "reopen": "Reabrir el formulario", "other_ways": "Contribuir otra cosa" },
  "fr": { "reopen": "Rouvrir le formulaire", "other_ways": "Contribuer autre chose" },
  "de": { "reopen": "Formular erneut öffnen", "other_ways": "Etwas anderes beitragen" },
  "it": { "reopen": "Riapri il modulo", "other_ways": "Contribuisci altro" },
  "pt": { "reopen": "Reabrir o formulário", "other_ways": "Contribuir outra coisa" },
  "ru": { "reopen": "Открыть форму снова", "other_ways": "Добавить что-то ещё" },
  "ja": { "reopen": "フォームを開き直す", "other_ways": "ほかのものを投稿する" },
  "zh": { "reopen": "重新打开表单", "other_ways": "贡献其他内容" },
  "ko": { "reopen": "양식 다시 열기", "other_ways": "다른 항목 기여하기" }
}
</i18n>
