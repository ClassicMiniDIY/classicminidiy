<script setup lang="ts">
  /**
   * The TypeSafe review card on an admin item: the lead line, the reasons,
   * and the scores behind them. A hint; the buttons on the item still decide.
   */
  const props = defineProps<{
    card: {
      hint: {
        scores?: Record<string, number>;
        quality?: number;
        category?: string;
        category_agrees?: boolean;
        lead?: string;
        reasons?: string[];
        trust?: string;
        gate?: string;
        duplicate?: string | null;
      } | null;
      decision: string | null;
    } | null;
    compact?: boolean;
  }>();

  const LEAD_TEXT: Record<string, string> = {
    none: 'Reads as a normal, well-formed submission.',
    wrong_place: 'Belongs in a different category or part of the site.',
    needs_detail: 'Genuine but too thin to publish as is.',
    looks_off: 'Something should be checked before publishing.',
  };
  const badge = computed(() => {
    const d = props.card?.decision;
    return d === 'auto'
      ? { cls: 'badge-success', text: 'auto-approved' }
      : d === 'clear'
        ? { cls: 'badge-success badge-outline', text: 'clear' }
        : d === 'flag'
          ? { cls: 'badge-warning', text: 'look at this' }
          : { cls: 'badge-ghost', text: 'no card' };
  });
  const scores = computed(() =>
    Object.entries(props.card?.hint?.scores ?? {})
      .map(([k, v]) => ({ k, v: Number(v) }))
      .sort((a, b) => a.k.localeCompare(b.k))
  );
</script>

<template>
  <div
    v-if="card?.hint"
    class="rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm"
    :class="{ 'py-2': compact }"
  >
    <div class="flex flex-wrap items-center gap-2">
      <i class="fas fa-scale-balanced opacity-60"></i>
      <span class="badge badge-sm" :class="badge.cls">{{ badge.text }}</span>
      <span class="min-w-0 break-words">{{ LEAD_TEXT[card.hint.lead ?? 'none'] ?? card.hint.lead }}</span>
      <span v-if="card.hint.quality !== undefined" class="badge badge-ghost badge-xs"
        >quality {{ card.hint.quality }}/2</span
      >
      <span
        v-if="card.hint.category && card.hint.category_agrees === false"
        class="badge badge-warning badge-outline badge-xs"
      >
        reads as {{ card.hint.category }}
      </span>
    </div>
    <ul v-if="card.hint.reasons?.length" class="mt-1 list-disc pl-6 opacity-80">
      <li v-for="r in card.hint.reasons" :key="r" class="break-words">{{ r }}</li>
    </ul>
    <details v-if="!compact && scores.length" class="mt-1">
      <summary class="cursor-pointer text-xs opacity-60">
        scores · submitter {{ card.hint.trust }} · gate {{ card.hint.gate }}
      </summary>
      <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-70">
        <span v-for="s in scores" :key="s.k"
          ><code>{{ s.k }}</code> {{ s.v.toFixed(2) }}</span
        >
      </div>
    </details>
  </div>
</template>
