<script lang="ts" setup>
  /**
   * A direct answer in the search palette or on /search: the thing itself,
   * not a link to the page that holds it. One component for all six kinds
   * rather than six files, because they share the frame (kind badge, title,
   * value line, "open" affordance) and differ only in the value line.
   *
   * Presentational. The parent decides what wraps it — a keyboard row in the
   * palette, a card link on the results page — and where "open" goes; `url`
   * is on the answer and the parent owns navigation and tracking.
   */
  import type { DirectAnswer } from '~~/shared/utils/searchIntent';
  import { TORQUE_UNITS, CLEARANCE_UNITS } from '~~/data/models/units';

  const props = defineProps<{
    answer: DirectAnswer;
    /** Bigger type and full-width value line on the results page. */
    large?: boolean;
  }>();

  const { t } = useI18n();

  const kindLabel = computed(() => t(`kind.${props.answer.kind}`));

  const icon = computed(() => {
    switch (props.answer.kind) {
      case 'part':
        return 'fas fa-gear';
      case 'colour':
        return 'fas fa-palette';
      case 'chassis':
        return 'fas fa-id-card';
      case 'engine':
        return 'fas fa-engine';
      case 'torque':
        return 'fas fa-screwdriver-wrench';
      case 'clearance':
        return 'fas fa-ruler';
    }
  });

  const title = computed(() => {
    const answer = props.answer;
    switch (answer.kind) {
      case 'part':
        return answer.partNumber;
      case 'colour':
        return answer.name;
      case 'chassis':
        return answer.chassisNumber;
      case 'engine':
        return answer.code;
      case 'torque':
      case 'clearance':
        return answer.item;
    }
  });

  /** Short unit labels, derived from the unit contract rather than restated. */
  const lbftUnit = TORQUE_UNITS.lbft!.match(/\(([^)]+)\)/)?.[1] ?? 'lb-ft';
  const nmUnit = TORQUE_UNITS.nm!.match(/\(([^)]+)\)/)?.[1] ?? 'Nm';
  const mmUnit = CLEARANCE_UNITS.mm!.match(/\(([^)]+)\)/)?.[1] ?? 'mm';
</script>

<template>
  <div class="flex w-full min-w-0 items-start gap-3" :class="large ? 'py-1' : ''">
    <span
      class="flex shrink-0 items-center justify-center rounded-field bg-primary/10 text-primary"
      :class="large ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-base'"
      aria-hidden="true"
    >
      <span
        v-if="answer.kind === 'colour' && answer.hex"
        class="block rounded-full border border-base-300"
        :class="large ? 'h-7 w-7' : 'h-5 w-5'"
        :style="{ backgroundColor: answer.hex }"
      ></span>
      <i v-else :class="icon"></i>
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          class="badge badge-sm badge-primary rounded-full border-0 text-[11px] font-bold uppercase tracking-[0.06em]"
        >
          {{ kindLabel }}
        </span>
        <span class="truncate font-bold" :class="large ? 'text-base lg:text-lg' : 'text-[14.5px]'">{{ title }}</span>
      </span>

      <!-- Value line, one per kind -->
      <span v-if="answer.kind === 'part'" class="mt-0.5 block text-[13px] opacity-75">
        {{ [answer.description, answer.system].filter(Boolean).join(' · ') || t('part_no_description') }}
        <template v-if="answer.sourceName"> · {{ answer.sourceName }}</template>
      </span>

      <span v-else-if="answer.kind === 'colour'" class="mt-0.5 block text-[13px] opacity-75">
        {{ [answer.code, answer.shortCode, answer.years].filter(Boolean).join(' · ') }}
      </span>

      <span v-else-if="answer.kind === 'chassis'" class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px]">
        <span class="opacity-60">{{ answer.yearRange }}</span>
        <span v-for="field in answer.fields" :key="field.label + field.value">
          <span class="font-mono font-semibold">{{ field.label }}</span>
          <span class="opacity-75"> {{ field.value }}</span>
        </span>
      </span>

      <span v-else-if="answer.kind === 'engine'" class="mt-0.5 block text-[13px] opacity-75">
        {{ [`${answer.capacityCc}cc`, answer.variant, answer.gearbox, answer.description].filter(Boolean).join(' · ') }}
      </span>

      <span v-else-if="answer.kind === 'torque'" class="mt-0.5 block text-[13px]">
        <span class="font-mono font-bold" :class="large ? 'text-lg' : 'text-[15px]'"
          >{{ answer.lbft }} {{ lbftUnit }}</span
        >
        <span class="opacity-60"> · {{ answer.nm }} {{ nmUnit }} · {{ answer.section }}</span>
        <span v-if="answer.notes" class="block truncate opacity-60">{{ answer.notes }}</span>
      </span>

      <span v-else-if="answer.kind === 'clearance'" class="mt-0.5 block text-[13px]">
        <span class="font-mono font-bold" :class="large ? 'text-lg' : 'text-[15px]'">{{ answer.thou }} in</span>
        <span class="opacity-60"> · {{ answer.mm }} {{ mmUnit }} · {{ answer.section }}</span>
        <span v-if="answer.notes" class="block truncate opacity-60">{{ answer.notes }}</span>
      </span>
    </span>

    <span class="hidden shrink-0 self-center text-xs font-semibold text-primary sm:inline">{{ t('open') }} &rarr;</span>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "open": "Open",
    "part_no_description": "Part in the archive",
    "kind": {
      "part": "Part",
      "colour": "Colour",
      "chassis": "Chassis",
      "engine": "Engine",
      "torque": "Torque",
      "clearance": "Clearance"
    }
  },
  "es": {
    "open": "Abrir",
    "part_no_description": "Pieza en el archivo",
    "kind": {
      "part": "Pieza",
      "colour": "Color",
      "chassis": "Chasis",
      "engine": "Motor",
      "torque": "Par",
      "clearance": "Holgura"
    }
  },
  "fr": {
    "open": "Ouvrir",
    "part_no_description": "Pièce dans les archives",
    "kind": {
      "part": "Pièce",
      "colour": "Couleur",
      "chassis": "Châssis",
      "engine": "Moteur",
      "torque": "Couple",
      "clearance": "Jeu"
    }
  },
  "de": {
    "open": "Öffnen",
    "part_no_description": "Teil im Archiv",
    "kind": {
      "part": "Teil",
      "colour": "Farbe",
      "chassis": "Fahrgestell",
      "engine": "Motor",
      "torque": "Drehmoment",
      "clearance": "Spiel"
    }
  },
  "it": {
    "open": "Apri",
    "part_no_description": "Ricambio in archivio",
    "kind": {
      "part": "Ricambio",
      "colour": "Colore",
      "chassis": "Telaio",
      "engine": "Motore",
      "torque": "Coppia",
      "clearance": "Gioco"
    }
  },
  "pt": {
    "open": "Abrir",
    "part_no_description": "Peça no arquivo",
    "kind": {
      "part": "Peça",
      "colour": "Cor",
      "chassis": "Chassi",
      "engine": "Motor",
      "torque": "Binário",
      "clearance": "Folga"
    }
  },
  "ru": {
    "open": "Открыть",
    "part_no_description": "Деталь в архиве",
    "kind": {
      "part": "Деталь",
      "colour": "Цвет",
      "chassis": "Шасси",
      "engine": "Двигатель",
      "torque": "Момент",
      "clearance": "Зазор"
    }
  },
  "ja": {
    "open": "開く",
    "part_no_description": "アーカイブの部品",
    "kind": {
      "part": "部品",
      "colour": "カラー",
      "chassis": "シャシー",
      "engine": "エンジン",
      "torque": "トルク",
      "clearance": "クリアランス"
    }
  },
  "zh": {
    "open": "打开",
    "part_no_description": "档案中的零件",
    "kind": {
      "part": "零件",
      "colour": "颜色",
      "chassis": "底盘",
      "engine": "发动机",
      "torque": "扭矩",
      "clearance": "间隙"
    }
  },
  "ko": {
    "open": "열기",
    "part_no_description": "아카이브의 부품",
    "kind": {
      "part": "부품",
      "colour": "색상",
      "chassis": "섀시",
      "engine": "엔진",
      "torque": "토크",
      "clearance": "간극"
    }
  }
}
</i18n>
