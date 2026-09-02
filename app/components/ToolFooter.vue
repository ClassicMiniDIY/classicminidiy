<script lang="ts" setup>
  /**
   * Connective tissue below a tool (design S5).
   *
   * The tool itself is deliberately untouched by this pass — this component only
   * ever renders BELOW it, and adds three things:
   *   1. FROM THE ARCHIVE — 2–3 curated cross-links, per tool.
   *   2. "Spotted a wrong value?" — opens the contribute wizard pre-set to
   *      Fix or addition, so a correction lands in the same review queue as
   *      everything else.
   *   3. Records the visit for the toolbox's recently-used chips.
   *
   * Drop it at the bottom of a tool page with `<ToolFooter slug="compression" />`.
   */
  import { toolBySlug } from '../../data/models/toolbox-catalog';

  const props = defineProps<{ slug: string }>();

  const { t } = useI18n();
  const { openWizard } = useContributeWizard();
  const { record } = useRecentTools();

  const tool = computed(() => toolBySlug(props.slug));

  const suggestCorrection = () =>
    openWizard({
      kind: 'fix',
      targetTitle: tool.value?.name ?? null,
      origin: tool.value?.to ?? `/technical/${props.slug}`,
    });

  onMounted(() => record(props.slug));
</script>

<template>
  <div v-if="tool" class="mt-6 grid gap-4 md:grid-cols-2">
    <div class="rounded-box bg-base-200 px-5 py-4.5">
      <p class="mb-2.5 text-xs font-bold uppercase tracking-[0.08em] opacity-55">{{ t('from_archive') }}</p>
      <p v-for="link in tool.relatedArchive" :key="link.to" class="mb-1.5 text-sm last:mb-0">
        <NuxtLink :to="link.to" class="font-semibold text-primary hover:underline">
          <i :class="link.icon" aria-hidden="true"></i>
          {{ link.label }}
        </NuxtLink>
      </p>
    </div>

    <div class="flex items-center gap-3.5 rounded-box border border-dashed border-base-300 px-5 py-4.5">
      <i class="fas fa-wrench text-lg text-secondary" aria-hidden="true"></i>
      <div>
        <p class="text-sm font-semibold">{{ t('spotted_title') }}</p>
        <p class="mt-0.5 text-[13px] opacity-75">
          <button type="button" class="font-bold text-secondary hover:underline" @click="suggestCorrection()">
            {{ t('suggest_correction') }} &rarr;
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "from_archive": "From the archive",
    "spotted_title": "Spotted a wrong value?",
    "suggest_correction": "Suggest a correction"
  },
  "es": {
    "from_archive": "Del archivo",
    "spotted_title": "¿Has visto un valor incorrecto?",
    "suggest_correction": "Sugerir una corrección"
  },
  "fr": {
    "from_archive": "Depuis les archives",
    "spotted_title": "Une valeur erronée ?",
    "suggest_correction": "Proposer une correction"
  },
  "de": {
    "from_archive": "Aus dem Archiv",
    "spotted_title": "Falscher Wert entdeckt?",
    "suggest_correction": "Korrektur vorschlagen"
  },
  "it": {
    "from_archive": "Dall'archivio",
    "spotted_title": "Hai notato un valore sbagliato?",
    "suggest_correction": "Suggerisci una correzione"
  },
  "pt": {
    "from_archive": "Do arquivo",
    "spotted_title": "Encontrou um valor errado?",
    "suggest_correction": "Sugerir uma correção"
  },
  "ru": {
    "from_archive": "Из архива",
    "spotted_title": "Заметили неверное значение?",
    "suggest_correction": "Предложить исправление"
  },
  "ja": {
    "from_archive": "アーカイブから",
    "spotted_title": "値の誤りを見つけましたか？",
    "suggest_correction": "修正を提案する"
  },
  "zh": {
    "from_archive": "来自档案馆",
    "spotted_title": "发现数值有误？",
    "suggest_correction": "提交更正"
  },
  "ko": {
    "from_archive": "아카이브에서",
    "spotted_title": "잘못된 값을 발견하셨나요?",
    "suggest_correction": "수정 제안하기"
  }
}
</i18n>
