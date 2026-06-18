<template>
  <div v-if="hasModifications" class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h2 class="card-title flex items-center gap-2">
        <i class="fas fa-screwdriver-wrench"></i>
        {{ t('title') }}
      </h2>

      <!-- Variant & Factory Options -->
      <div v-if="listing.variant || hasFactoryOptions" class="mt-4">
        <div class="grid md:grid-cols-2 gap-4">
          <!-- Variant -->
          <div v-if="listing.variant" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('variant') }}</div>
            <div>
              <span class="badge badge-lg badge-primary">{{ formatVariant(listing.variant) }}</span>
            </div>
          </div>

          <!-- Factory Options -->
          <div v-if="hasFactoryOptions" class="space-y-1 md:col-span-2">
            <div class="text-sm text-base-content/70 mb-2">{{ t('factoryOptions') }}</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="option in listing.factory_options" :key="option" class="badge badge-outline">
                {{ formatFactoryOption(option) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modifications -->
      <div v-if="hasModificationDetails" class="mt-6">
        <h3 class="text-lg font-semibold mb-3">{{ t('modifications') }}</h3>
        <div class="space-y-4">
          <!-- Engine Mods -->
          <div v-if="listing.engine_mods" class="space-y-1">
            <div class="text-sm font-medium text-base-content/70">{{ t('engineMods') }}</div>
            <p class="text-sm whitespace-pre-line">{{ listing.engine_mods }}</p>
          </div>

          <!-- Suspension Mods -->
          <div v-if="listing.suspension_mods" class="space-y-1">
            <div class="text-sm font-medium text-base-content/70">{{ t('suspensionMods') }}</div>
            <p class="text-sm whitespace-pre-line">{{ listing.suspension_mods }}</p>
          </div>

          <!-- Performance Upgrades -->
          <div v-if="listing.performance_upgrades" class="space-y-1">
            <div class="text-sm font-medium text-base-content/70">{{ t('performanceUpgrades') }}</div>
            <p class="text-sm whitespace-pre-line">{{ listing.performance_upgrades }}</p>
          </div>

          <!-- Other Modifications -->
          <div v-if="listing.other_modifications" class="space-y-1">
            <div class="text-sm font-medium text-base-content/70">{{ t('otherModifications') }}</div>
            <p class="text-sm whitespace-pre-line">{{ listing.other_modifications }}</p>
          </div>
        </div>
      </div>

      <!-- Condition Assessment -->
      <div v-if="hasConditionInfo" class="mt-6">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <i class="fas fa-clipboard-check"></i>
          {{ t('conditionAssessment') }}
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          <!-- Rust Condition -->
          <div v-if="listing.rust_condition" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('rustCondition') }}</div>
            <div>
              <span :class="getRustBadgeClass(listing.rust_condition)">
                {{ formatRustCondition(listing.rust_condition) }}
              </span>
            </div>
          </div>

          <!-- Underside Condition -->
          <div v-if="listing.underside_condition" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('undersideCondition') }}</div>
            <div>
              <span :class="getUndersideBadgeClass(listing.underside_condition)">
                {{ formatUndersideCondition(listing.underside_condition) }}
              </span>
            </div>
          </div>

          <!-- Casing Stamps -->
          <div v-if="listing.casing_stamps" class="space-y-1 md:col-span-2">
            <div class="text-sm text-base-content/70">{{ t('casingStamps') }}</div>
            <p class="text-sm font-mono">{{ listing.casing_stamps }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import {
    MINI_VARIANTS,
    FACTORY_OPTIONS,
    RUST_CONDITIONS,
    UNDERSIDE_CONDITIONS,
    getSpecLabel,
  } from '~/utils/miniSpecs';

  const { t } = useI18n();

  interface Props {
    listing: ListingWithPhotos;
  }

  const props = defineProps<Props>();

  // Check if listing has factory options
  const hasFactoryOptions = computed(() => {
    return props.listing.factory_options && props.listing.factory_options.length > 0;
  });

  // Check if listing has modification details
  const hasModificationDetails = computed(() => {
    return !!(
      props.listing.engine_mods ||
      props.listing.suspension_mods ||
      props.listing.performance_upgrades ||
      props.listing.other_modifications
    );
  });

  // Check if listing has condition information
  const hasConditionInfo = computed(() => {
    return !!(props.listing.rust_condition || props.listing.underside_condition || props.listing.casing_stamps);
  });

  // Check if listing has any modifications/condition data to display
  const hasModifications = computed(() => {
    return !!(
      props.listing.variant ||
      hasFactoryOptions.value ||
      hasModificationDetails.value ||
      hasConditionInfo.value
    );
  });

  // Format helper functions
  const formatVariant = (value: string) => getSpecLabel(MINI_VARIANTS, value);

  const formatFactoryOption = (value: string) => {
    const option = FACTORY_OPTIONS.find((o) => o.value === value);
    if (option) return option.label;
    // Fallback: convert snake_case to Title Case
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatRustCondition = (value: string) => getSpecLabel(RUST_CONDITIONS, value);
  const formatUndersideCondition = (value: string) => getSpecLabel(UNDERSIDE_CONDITIONS, value);

  // Badge color helpers
  const getRustBadgeClass = (condition: string) => {
    const baseClasses = 'badge badge-lg';
    switch (condition) {
      case 'none_visible':
        return `${baseClasses} badge-success`;
      case 'minor_surface':
        return `${baseClasses} badge-info`;
      case 'moderate':
        return `${baseClasses} badge-warning`;
      case 'significant':
        return `${baseClasses} badge-error`;
      default:
        return `${baseClasses} badge-ghost`;
    }
  };

  const getUndersideBadgeClass = (condition: string) => {
    const baseClasses = 'badge badge-lg';
    switch (condition) {
      case 'excellent':
        return `${baseClasses} badge-success`;
      case 'good':
        return `${baseClasses} badge-info`;
      case 'fair':
        return `${baseClasses} badge-warning`;
      case 'needs_work':
        return `${baseClasses} badge-error`;
      default:
        return `${baseClasses} badge-ghost`;
    }
  };
</script>

<i18n lang="json">
{
  "en": {
    "title": "Modifications & Condition",
    "variant": "Variant",
    "factoryOptions": "Factory Options",
    "modifications": "Modifications",
    "engineMods": "Engine Modifications",
    "suspensionMods": "Suspension Modifications",
    "performanceUpgrades": "Performance Upgrades",
    "otherModifications": "Other Modifications",
    "conditionAssessment": "Condition Assessment",
    "rustCondition": "Rust Condition",
    "undersideCondition": "Underside Condition",
    "casingStamps": "Engine Casing Stamps & Markings"
  },
  "es": {
    "title": "Modificaciones y estado",
    "variant": "Variante",
    "factoryOptions": "Opciones de fábrica",
    "modifications": "Modificaciones",
    "engineMods": "Modificaciones del motor",
    "suspensionMods": "Modificaciones de la suspensión",
    "performanceUpgrades": "Mejoras de rendimiento",
    "otherModifications": "Otras modificaciones",
    "conditionAssessment": "Evaluación del estado",
    "rustCondition": "Estado del óxido",
    "undersideCondition": "Estado de los bajos",
    "casingStamps": "Sellos y marcas del bloque motor"
  },
  "fr": {
    "title": "Modifications et état",
    "variant": "Variante",
    "factoryOptions": "Options d'usine",
    "modifications": "Modifications",
    "engineMods": "Modifications moteur",
    "suspensionMods": "Modifications de suspension",
    "performanceUpgrades": "Améliorations de performance",
    "otherModifications": "Autres modifications",
    "conditionAssessment": "Évaluation de l'état",
    "rustCondition": "État de la corrosion",
    "undersideCondition": "État du dessous de caisse",
    "casingStamps": "Marquages et frappes du bloc moteur"
  },
  "de": {
    "title": "Modifikationen & Zustand",
    "variant": "Variante",
    "factoryOptions": "Werksausstattung",
    "modifications": "Modifikationen",
    "engineMods": "Motormodifikationen",
    "suspensionMods": "Fahrwerksmodifikationen",
    "performanceUpgrades": "Leistungssteigerungen",
    "otherModifications": "Weitere Modifikationen",
    "conditionAssessment": "Zustandsbewertung",
    "rustCondition": "Rostzustand",
    "undersideCondition": "Zustand der Unterseite",
    "casingStamps": "Motorblock-Prägungen & Markierungen"
  },
  "it": {
    "title": "Modifiche e condizioni",
    "variant": "Variante",
    "factoryOptions": "Optional di fabbrica",
    "modifications": "Modifiche",
    "engineMods": "Modifiche al motore",
    "suspensionMods": "Modifiche alle sospensioni",
    "performanceUpgrades": "Miglioramenti delle prestazioni",
    "otherModifications": "Altre modifiche",
    "conditionAssessment": "Valutazione delle condizioni",
    "rustCondition": "Condizione della ruggine",
    "undersideCondition": "Condizione del sottoscocca",
    "casingStamps": "Punzonature e marcature del basamento motore"
  },
  "pt": {
    "title": "Modificações e estado",
    "variant": "Variante",
    "factoryOptions": "Opcionais de fábrica",
    "modifications": "Modificações",
    "engineMods": "Modificações no motor",
    "suspensionMods": "Modificações na suspensão",
    "performanceUpgrades": "Melhorias de desempenho",
    "otherModifications": "Outras modificações",
    "conditionAssessment": "Avaliação do estado",
    "rustCondition": "Estado da ferrugem",
    "undersideCondition": "Estado da parte inferior",
    "casingStamps": "Carimbos e marcações do bloco do motor"
  },
  "ru": {
    "title": "Модификации и состояние",
    "variant": "Вариант",
    "factoryOptions": "Заводские опции",
    "modifications": "Модификации",
    "engineMods": "Доработки двигателя",
    "suspensionMods": "Доработки подвески",
    "performanceUpgrades": "Улучшения производительности",
    "otherModifications": "Прочие доработки",
    "conditionAssessment": "Оценка состояния",
    "rustCondition": "Состояние коррозии",
    "undersideCondition": "Состояние днища",
    "casingStamps": "Клейма и маркировки блока двигателя"
  },
  "ja": {
    "title": "改造と状態",
    "variant": "バリエーション",
    "factoryOptions": "工場オプション",
    "modifications": "改造内容",
    "engineMods": "エンジンの改造",
    "suspensionMods": "サスペンションの改造",
    "performanceUpgrades": "パフォーマンスのアップグレード",
    "otherModifications": "その他の改造",
    "conditionAssessment": "状態の評価",
    "rustCondition": "サビの状態",
    "undersideCondition": "下回りの状態",
    "casingStamps": "エンジンブロックの刻印とマーキング"
  },
  "zh": {
    "title": "改装与车况",
    "variant": "车型版本",
    "factoryOptions": "原厂选装",
    "modifications": "改装项目",
    "engineMods": "发动机改装",
    "suspensionMods": "悬挂改装",
    "performanceUpgrades": "性能升级",
    "otherModifications": "其他改装",
    "conditionAssessment": "车况评估",
    "rustCondition": "锈蚀情况",
    "undersideCondition": "底盘情况",
    "casingStamps": "发动机缸体钢印与标记"
  },
  "ko": {
    "title": "개조 및 상태",
    "variant": "세부 모델",
    "factoryOptions": "공장 옵션",
    "modifications": "개조 내역",
    "engineMods": "엔진 개조",
    "suspensionMods": "서스펜션 개조",
    "performanceUpgrades": "성능 업그레이드",
    "otherModifications": "기타 개조",
    "conditionAssessment": "상태 평가",
    "rustCondition": "녹 상태",
    "undersideCondition": "하부 상태",
    "casingStamps": "엔진 블록 각인 및 마킹"
  }
}
</i18n>
