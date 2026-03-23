<script lang="ts" setup>
  withDefaults(
    defineProps<{
      links: Record<string, string>;
      size?: 'sm' | 'md';
    }>(),
    { size: 'md' }
  );

  const platformIcons: Record<string, string> = {
    instagram: 'fab fa-instagram',
    youtube: 'fab fa-youtube',
    facebook: 'fab fa-facebook',
    website: 'fas fa-globe',
    tiktok: 'fab fa-tiktok',
    x: 'fab fa-x-twitter',
    bluesky: 'fab fa-bluesky',
  };

  function normalizeUrl(platform: string, value: string): string {
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (platform === 'website') return `https://${value}`;
    return value;
  }
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <template v-for="(url, platform) in links" :key="platform">
      <a
        v-if="url"
        :href="normalizeUrl(platform as string, url)"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center justify-center rounded-full bg-muted hover:bg-primary hover:text-primary-content transition-colors"
        :class="size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'"
        :aria-label="platform as string"
      >
        <i :class="platformIcons[platform as string] || 'fas fa-link'"></i>
      </a>
    </template>
  </div>
</template>
