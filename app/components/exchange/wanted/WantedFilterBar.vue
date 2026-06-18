<template>
  <div class="flex flex-wrap gap-3 items-end">
    <!-- Category Filter -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('category.label') }}</legend>
      <select
        :value="category"
        class="select select-bordered select-sm"
        @change="emit('update:category', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('all') }}</option>
        <option value="vehicle">{{ t('category.vehicle') }}</option>
        <option value="engine">{{ t('category.engine') }}</option>
        <option value="parts">{{ t('category.parts') }}</option>
      </select>
    </fieldset>

    <!-- Condition Preference Filter -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('condition.label') }}</legend>
      <select
        :value="conditionPreference"
        class="select select-bordered select-sm"
        @change="emit('update:conditionPreference', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('all') }}</option>
        <option value="any">{{ t('condition.any') }}</option>
        <option value="excellent">{{ t('condition.excellent') }}</option>
        <option value="good">{{ t('condition.good') }}</option>
        <option value="fair">{{ t('condition.fair') }}</option>
        <option value="project">{{ t('condition.project') }}</option>
      </select>
    </fieldset>

    <!-- Budget Min -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('budgetMin.label') }}</legend>
      <input
        type="number"
        class="input input-bordered input-sm w-24"
        :placeholder="t('budgetMin.placeholder')"
        :value="budgetMin"
        min="0"
        @input="handleBudgetMin"
      />
    </fieldset>

    <!-- Budget Max -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('budgetMax.label') }}</legend>
      <input
        type="number"
        class="input input-bordered input-sm w-24"
        :placeholder="t('budgetMax.placeholder')"
        :value="budgetMax"
        min="0"
        @input="handleBudgetMax"
      />
    </fieldset>

    <!-- Country -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('country.label') }}</legend>
      <input
        type="text"
        class="input input-bordered input-sm w-32"
        :placeholder="t('country.placeholder')"
        :value="country"
        @input="emit('update:country', ($event.target as HTMLInputElement).value)"
      />
    </fieldset>

    <!-- Clear All Button -->
    <button v-if="hasActiveFilters" type="button" class="btn btn-ghost btn-sm" @click="emit('clear')">
      <i class="fas fa-xmark"></i>
      {{ t('clearAll') }}
    </button>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    category: string;
    conditionPreference: string;
    budgetMin: number | undefined;
    budgetMax: number | undefined;
    country: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:category', value: string): void;
    (e: 'update:conditionPreference', value: string): void;
    (e: 'update:budgetMin', value: number | undefined): void;
    (e: 'update:budgetMax', value: number | undefined): void;
    (e: 'update:country', value: string): void;
    (e: 'clear'): void;
  }>();

  const hasActiveFilters = computed(
    () =>
      !!(
        props.category ||
        props.conditionPreference ||
        props.budgetMin !== undefined ||
        props.budgetMax !== undefined ||
        props.country
      )
  );

  const handleBudgetMin = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    emit('update:budgetMin', value ? Number(value) : undefined);
  };

  const handleBudgetMax = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    emit('update:budgetMax', value ? Number(value) : undefined);
  };
</script>

<i18n lang="json">
{
  "en": {
    "all": "All",
    "clearAll": "Clear All",
    "category": { "label": "Category", "vehicle": "Vehicle", "engine": "Engine", "parts": "Parts" },
    "condition": { "label": "Condition", "any": "Any", "excellent": "Excellent", "good": "Good", "fair": "Fair", "project": "Project" },
    "budgetMin": { "label": "Budget Min", "placeholder": "Min" },
    "budgetMax": { "label": "Budget Max", "placeholder": "Max" },
    "country": { "label": "Country", "placeholder": "Country" }
  },
  "es": {
    "all": "Todos",
    "clearAll": "Borrar todo",
    "category": { "label": "Categoría", "vehicle": "Vehículo", "engine": "Motor", "parts": "Piezas" },
    "condition": { "label": "Estado", "any": "Cualquiera", "excellent": "Excelente", "good": "Bueno", "fair": "Aceptable", "project": "Proyecto" },
    "budgetMin": { "label": "Presupuesto mín.", "placeholder": "Mín." },
    "budgetMax": { "label": "Presupuesto máx.", "placeholder": "Máx." },
    "country": { "label": "País", "placeholder": "País" }
  },
  "fr": {
    "all": "Tous",
    "clearAll": "Tout effacer",
    "category": { "label": "Catégorie", "vehicle": "Véhicule", "engine": "Moteur", "parts": "Pièces" },
    "condition": { "label": "État", "any": "Tous", "excellent": "Excellent", "good": "Bon", "fair": "Correct", "project": "Projet" },
    "budgetMin": { "label": "Budget min.", "placeholder": "Min." },
    "budgetMax": { "label": "Budget max.", "placeholder": "Max." },
    "country": { "label": "Pays", "placeholder": "Pays" }
  },
  "de": {
    "all": "Alle",
    "clearAll": "Alle löschen",
    "category": { "label": "Kategorie", "vehicle": "Fahrzeug", "engine": "Motor", "parts": "Teile" },
    "condition": { "label": "Zustand", "any": "Beliebig", "excellent": "Ausgezeichnet", "good": "Gut", "fair": "Akzeptabel", "project": "Projekt" },
    "budgetMin": { "label": "Budget Min.", "placeholder": "Min." },
    "budgetMax": { "label": "Budget Max.", "placeholder": "Max." },
    "country": { "label": "Land", "placeholder": "Land" }
  },
  "it": {
    "all": "Tutti",
    "clearAll": "Cancella tutto",
    "category": { "label": "Categoria", "vehicle": "Veicolo", "engine": "Motore", "parts": "Ricambi" },
    "condition": { "label": "Condizione", "any": "Qualsiasi", "excellent": "Eccellente", "good": "Buono", "fair": "Discreto", "project": "Progetto" },
    "budgetMin": { "label": "Budget min.", "placeholder": "Min." },
    "budgetMax": { "label": "Budget max.", "placeholder": "Max." },
    "country": { "label": "Paese", "placeholder": "Paese" }
  },
  "pt": {
    "all": "Todos",
    "clearAll": "Limpar tudo",
    "category": { "label": "Categoria", "vehicle": "Veículo", "engine": "Motor", "parts": "Peças" },
    "condition": { "label": "Condição", "any": "Qualquer", "excellent": "Excelente", "good": "Bom", "fair": "Razoável", "project": "Projeto" },
    "budgetMin": { "label": "Orçamento mín.", "placeholder": "Mín." },
    "budgetMax": { "label": "Orçamento máx.", "placeholder": "Máx." },
    "country": { "label": "País", "placeholder": "País" }
  },
  "ru": {
    "all": "Все",
    "clearAll": "Очистить все",
    "category": { "label": "Категория", "vehicle": "Автомобиль", "engine": "Двигатель", "parts": "Запчасти" },
    "condition": { "label": "Состояние", "any": "Любое", "excellent": "Отличное", "good": "Хорошее", "fair": "Удовлетворительное", "project": "Под восстановление" },
    "budgetMin": { "label": "Бюджет мин.", "placeholder": "Мин." },
    "budgetMax": { "label": "Бюджет макс.", "placeholder": "Макс." },
    "country": { "label": "Страна", "placeholder": "Страна" }
  },
  "ja": {
    "all": "すべて",
    "clearAll": "すべてクリア",
    "category": { "label": "カテゴリー", "vehicle": "車両", "engine": "エンジン", "parts": "パーツ" },
    "condition": { "label": "状態", "any": "指定なし", "excellent": "極上", "good": "良好", "fair": "並", "project": "レストア向き" },
    "budgetMin": { "label": "予算（最小）", "placeholder": "最小" },
    "budgetMax": { "label": "予算（最大）", "placeholder": "最大" },
    "country": { "label": "国", "placeholder": "国" }
  },
  "zh": {
    "all": "全部",
    "clearAll": "清除全部",
    "category": { "label": "类别", "vehicle": "整车", "engine": "发动机", "parts": "零件" },
    "condition": { "label": "成色", "any": "不限", "excellent": "极佳", "good": "良好", "fair": "一般", "project": "待修复" },
    "budgetMin": { "label": "预算下限", "placeholder": "最低" },
    "budgetMax": { "label": "预算上限", "placeholder": "最高" },
    "country": { "label": "国家", "placeholder": "国家" }
  },
  "ko": {
    "all": "전체",
    "clearAll": "모두 지우기",
    "category": { "label": "카테고리", "vehicle": "차량", "engine": "엔진", "parts": "부품" },
    "condition": { "label": "상태", "any": "전체", "excellent": "최상", "good": "양호", "fair": "보통", "project": "복원용" },
    "budgetMin": { "label": "예산 최소", "placeholder": "최소" },
    "budgetMax": { "label": "예산 최대", "placeholder": "최대" },
    "country": { "label": "국가", "placeholder": "국가" }
  }
}
</i18n>
