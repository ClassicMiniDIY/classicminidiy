<script setup lang="ts">
  import type { ModelLicenseInfo } from '~~/data/models/model-library';

  const props = withDefaults(
    defineProps<{
      license: ModelLicenseInfo;
      /** Compact mode hides the derived permission chips (used on cards). */
      compact?: boolean;
    }>(),
    { compact: false }
  );

  interface Chip {
    label: string;
    icon: string;
    tone: 'success' | 'warning' | 'neutral' | 'error';
  }

  const chips = computed<Chip[]>(() => {
    const l = props.license;
    const out: Chip[] = [];
    out.push(
      l.allowsCommercialUse
        ? { label: 'Commercial OK', icon: 'fa-store', tone: 'success' }
        : { label: 'Non-commercial', icon: 'fa-ban', tone: 'warning' }
    );
    out.push(
      l.allowsDerivatives
        ? { label: 'Remix OK', icon: 'fa-code-branch', tone: 'success' }
        : { label: 'No derivatives', icon: 'fa-lock', tone: 'warning' }
    );
    if (l.requiresAttribution) out.push({ label: 'Attribution', icon: 'fa-user-pen', tone: 'neutral' });
    if (l.requiresShareAlike) out.push({ label: 'Share-alike', icon: 'fa-arrows-rotate', tone: 'neutral' });
    if (!l.allowsFileRedistribution)
      out.push({ label: 'No file sharing', icon: 'fa-file-circle-xmark', tone: 'error' });
    return out;
  });

  const toneClass: Record<Chip['tone'], string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    neutral: 'badge-neutral',
    error: 'badge-error',
  };
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <a
      v-if="license.url"
      :href="license.url"
      target="_blank"
      rel="noopener noreferrer"
      class="badge badge-lg gap-1.5"
      :class="license.isPaid ? 'badge-primary' : 'badge-outline'"
      :title="`${license.name} — view full license`"
    >
      <i class="fas" :class="license.isPaid ? 'fa-tag' : 'fa-scale-balanced'"></i>
      {{ license.name }}
    </a>
    <span v-else class="badge badge-lg gap-1.5" :class="license.isPaid ? 'badge-primary' : 'badge-outline'">
      <i class="fas" :class="license.isPaid ? 'fa-tag' : 'fa-scale-balanced'"></i>
      {{ license.name }}
    </span>

    <template v-if="!compact">
      <span v-for="chip in chips" :key="chip.label" class="badge badge-sm gap-1" :class="toneClass[chip.tone]">
        <i class="fas text-[0.65rem]" :class="chip.icon"></i>
        {{ chip.label }}
      </span>
    </template>
  </div>
</template>
