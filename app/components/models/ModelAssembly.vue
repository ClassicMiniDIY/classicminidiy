<script setup lang="ts">
  import type { AssemblyInstructions } from '~~/data/models/model-library';

  const props = defineProps<{ assembly: AssemblyInstructions | null }>();

  const difficultyTone: Record<string, string> = {
    easy: 'badge-success',
    moderate: 'badge-warning',
    advanced: 'badge-error',
  };

  const hasContent = computed(() => {
    const a = props.assembly;
    return (
      !!a &&
      (!!a.difficulty ||
        !!a.estimatedTimeMinutes ||
        (a.toolsRequired?.length ?? 0) > 0 ||
        (a.steps?.length ?? 0) > 0 ||
        (a.warnings?.length ?? 0) > 0)
    );
  });
</script>

<template>
  <div v-if="hasContent" class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h3 class="card-title text-lg"><i class="fas fa-list-check text-primary mr-1"></i> Assembly</h3>

      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="assembly?.difficulty"
          class="badge gap-1"
          :class="difficultyTone[assembly.difficulty] || 'badge-neutral'"
        >
          <i class="fas fa-gauge-high text-[0.65rem]"></i> {{ assembly.difficulty }}
        </span>
        <span v-if="assembly?.estimatedTimeMinutes" class="badge badge-outline gap-1">
          <i class="fas fa-clock text-[0.65rem]"></i> ~{{ assembly.estimatedTimeMinutes }} min
        </span>
      </div>

      <div v-if="(assembly?.toolsRequired?.length ?? 0) > 0" class="mt-1">
        <p class="text-xs opacity-60 mb-1"><i class="fas fa-toolbox mr-1"></i> Tools required</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tool in assembly?.toolsRequired" :key="tool" class="badge badge-ghost badge-sm">{{ tool }}</span>
        </div>
      </div>

      <ol v-if="(assembly?.steps?.length ?? 0) > 0" class="mt-3 space-y-2">
        <li v-for="(step, i) in assembly?.steps" :key="i" class="flex gap-3">
          <span class="badge badge-primary badge-sm shrink-0 mt-0.5">{{ i + 1 }}</span>
          <span class="text-sm">{{ step }}</span>
        </li>
      </ol>

      <div v-if="(assembly?.warnings?.length ?? 0) > 0" class="alert alert-warning alert-soft mt-3 items-start">
        <i class="fas fa-triangle-exclamation mt-0.5"></i>
        <ul class="text-sm list-disc list-inside">
          <li v-for="(w, i) in assembly?.warnings" :key="i">{{ w }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
