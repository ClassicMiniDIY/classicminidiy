<script setup lang="ts">
  /**
   * One TypeSafe switch: the effective mode, where it comes from (a settings
   * row or the Worker env), and a button per allowed value. The "ready" flag
   * only colours the next step; it never clicks it.
   */
  const props = defineProps<{
    row?: {
      surface: string;
      key: string;
      row: string | null;
      env: string;
      effective: string;
      updatedAt: string | null;
    };
    options: readonly string[];
    busy: string;
    ready: boolean;
    /** Rows that always keep a value (no env behind them). */
    noFallback?: boolean;
  }>();
  const emit = defineEmits<{ set: [key: string, value: string | null] }>();

  const isBusy = computed(() => Boolean(props.row && props.busy === props.row.key));
  function label(v: string) {
    return v === 'hint' ? 'hint' : v === 'hold' ? 'hold' : v;
  }
  function fmt(iso: string | null) {
    return iso ? new Date(iso).toLocaleString() : '';
  }
</script>

<template>
  <div v-if="row" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-base-200 p-3">
    <span class="text-sm">
      <code>{{ row.key }}</code>
      <span class="badge badge-sm ml-2" :class="row.effective === 'off' ? 'badge-ghost' : 'badge-primary'">{{
        row.effective
      }}</span>
      <span class="ml-2 text-xs opacity-60">
        <template v-if="row.row !== null"
          >from a settings row<template v-if="row.updatedAt"> · {{ fmt(row.updatedAt) }}</template></template
        >
        <template v-else>from the Worker env</template>
      </span>
    </span>
    <span class="grow"></span>
    <div class="join">
      <button
        v-for="opt in options"
        :key="opt"
        type="button"
        class="btn btn-xs join-item"
        :class="
          opt === row.effective
            ? 'btn-primary'
            : ready && options.indexOf(opt) === options.indexOf(row.effective) + 1
              ? 'btn-success btn-outline'
              : 'btn-outline'
        "
        :disabled="isBusy || opt === row.effective"
        @click="emit('set', row.key, opt)"
      >
        {{ label(opt) }}
      </button>
    </div>
    <button
      v-if="!noFallback && row.row !== null"
      type="button"
      class="btn btn-xs btn-ghost"
      :disabled="isBusy"
      title="Delete the settings row; the Worker env decides again"
      @click="emit('set', row.key, null)"
    >
      use env ({{ row.env }})
    </button>
  </div>
</template>
