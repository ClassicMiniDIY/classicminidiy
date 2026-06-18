<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold leading-none whitespace-nowrap"
    :class="sizeClass"
    :style="{ backgroundColor: brand.bg, color: brand.text }"
  >
    <img v-if="brand.logo" :src="brand.logo" :alt="brand.label" :class="iconClass" class="rounded-sm object-contain" />
    <i v-else class="fas fa-link" :class="iconClass"></i>

    <span v-if="!iconOnly">{{ brand.label }}</span>
  </span>
</template>

<script setup lang="ts">
  interface Props {
    site: string;
    size?: 'sm' | 'md';
    iconOnly?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 'sm',
    iconOnly: false,
  });

  interface BrandConfig {
    bg: string;
    text: string;
    label: string;
    logo: string | null;
  }

  const brandMap: Record<string, BrandConfig> = {
    bat: { bg: '#B12024', text: '#ffffff', label: 'Bring a Trailer', logo: '/logos/sources/bat.png' },
    carsandbids: { bg: '#0D9488', text: '#ffffff', label: 'Cars & Bids', logo: '/logos/sources/carsandbids.png' },
    copart: { bg: '#003B71', text: '#ffffff', label: 'Copart', logo: '/logos/sources/copart.png' },
    craigslist: { bg: '#5B2C82', text: '#ffffff', label: 'Craigslist', logo: '/logos/sources/craigslist.png' },
    facebook: { bg: '#1877F2', text: '#ffffff', label: 'Marketplace', logo: '/logos/sources/facebook.png' },
    ebay: { bg: '#E53238', text: '#ffffff', label: 'eBay', logo: '/logos/sources/ebay.png' },
    other: { bg: '#6B7280', text: '#ffffff', label: 'Other', logo: null },
  };

  const defaultBrand: BrandConfig = { bg: '#6B7280', text: '#ffffff', label: 'Other', logo: null };
  const brand = computed((): BrandConfig => brandMap[props.site] ?? defaultBrand);

  const sizeClass = computed(() => (props.size === 'md' ? 'text-sm px-2.5 py-1.5' : ''));
  const iconClass = computed(() => (props.size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'));
</script>
