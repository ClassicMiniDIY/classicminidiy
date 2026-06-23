<template>
  <div class="w-full py-4">
    <ul class="steps steps-horizontal w-full" :aria-label="t('progressLabel')">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="step"
        :class="{
          'step-primary': index <= currentStep,
        }"
        :data-content="index + 1"
        :aria-label="t('stepLabel', { number: index + 1, label: step.label })"
      >
        <span class="hidden sm:inline">{{ step.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface Step {
    id: string;
    label: string;
  }

  defineProps<{
    steps: Step[];
    currentStep: number;
  }>();
</script>

<i18n lang="json">
{
  "en": { "progressLabel": "Listing progress", "stepLabel": "Step {number}: {label}" },
  "es": { "progressLabel": "Progreso del anuncio", "stepLabel": "Paso {number}: {label}" },
  "fr": { "progressLabel": "Progression de l'annonce", "stepLabel": "Étape {number} : {label}" },
  "de": { "progressLabel": "Anzeigenfortschritt", "stepLabel": "Schritt {number}: {label}" },
  "it": { "progressLabel": "Avanzamento annuncio", "stepLabel": "Passaggio {number}: {label}" },
  "pt": { "progressLabel": "Progresso do anúncio", "stepLabel": "Etapa {number}: {label}" },
  "ru": { "progressLabel": "Ход создания объявления", "stepLabel": "Шаг {number}: {label}" },
  "ja": { "progressLabel": "出品の進行状況", "stepLabel": "ステップ {number}：{label}" },
  "zh": { "progressLabel": "刊登进度", "stepLabel": "第 {number} 步：{label}" },
  "ko": { "progressLabel": "등록 진행 상황", "stepLabel": "{number}단계: {label}" }
}
</i18n>
