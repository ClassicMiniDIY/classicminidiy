<script lang="ts" setup>
  import type { Color } from '../../../../data/models/colors';
  import { HERO_TYPES } from '../../../../data/models/generic';

  const { listColors } = useColors();
  const { data: colors, status } = await useAsyncData('colors-list', () => listColors());
  const pending = computed(() => status.value === 'pending');
  const search = ref('');
  const debouncedSearch = ref('');
  const currentPage = ref(1);
  const itemsPerPage = 10;

  // Debounce search input for better performance
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(search, (newValue) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch.value = newValue;
    }, 300);
  });

  onUnmounted(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });

  const tableHeaders = [
    { title: 'Share', key: 'share' },
    { title: 'Color Name', key: 'name' },
    { title: 'Swatch', key: 'imageSwatch' },
    { title: 'Short Code', key: 'shortCode' },
    { title: 'BMC Code', key: 'code' },
    { title: 'Ditzler/PPG Code', key: 'ditzlerPpgCode' },
    { title: 'Dulux Code', key: 'duluxCode' },
    { title: 'Years Used', key: 'years' },
    { title: 'Edit', key: 'edit' },
  ];

  const filteredColors = computed(() => {
    if (!colors.value) return [];
    if (!debouncedSearch.value.trim()) return colors.value;

    const searchTerm = debouncedSearch.value.toLowerCase().trim();
    return colors.value.filter(
      (color) =>
        (color.name?.toLowerCase() || '').includes(searchTerm) ||
        (color.shortCode?.toLowerCase() || '').includes(searchTerm) ||
        (color.code?.toLowerCase() || '').includes(searchTerm) ||
        (color.ditzlerPpgCode?.toLowerCase() || '').includes(searchTerm) ||
        (color.duluxCode?.toLowerCase() || '').includes(searchTerm)
    );
  });

  const paginatedColors = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredColors.value.slice(start, start + itemsPerPage);
  });

  const totalPages = computed(() => {
    return Math.ceil(filteredColors.value.length / itemsPerPage);
  });

  const shareColor = (color: Color) => {
    const url = `${window.location.origin}/archive/colors/${color.id}`;

    if (navigator.share) {
      navigator
        .share({
          title: `${$t('share.title')} ${color.name || $t('states.unnamed_color')}`,
          text: `${$t('share.text')} ${color.name || $t('states.unnamed_color')}`,
          url,
        })
        .catch(() => {
          // User cancelled or share failed - silently handle
        });
    } else {
      navigator.clipboard.writeText(url);
      alert($t('states.link_copied'));
    }
  };

  // Reset to first page when debounced search changes
  watch(debouncedSearch, () => {
    currentPage.value = 1;
  });

  useHead({
    title: $t('title'),
    meta: [
      {
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/colors',
      },
    ],
  });

  // Dataset structured data for colors database
  const colorsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Classic Mini Paint Color Database',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/colors',
    keywords: ['Classic Mini colors', 'paint codes', 'BMC colors', 'Mini Cooper paint'],
    creator: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
    license: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    isAccessibleForFree: true,
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'BMC Code',
        description: 'British Motor Corporation paint code',
      },
      {
        '@type': 'PropertyValue',
        name: 'Ditzler/PPG Code',
        description: 'Ditzler or PPG paint matching code',
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(colorsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/colors',
    ogType: 'website',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <!-- Breadcrumb -->
    <!-- Header -->
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="$t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-3xl font-bold">{{ $t('main_heading') }}</h1>
            <h2 class="text-xl mt-4">
              <strong>{{ colors?.length || '0' }}</strong>
              {{ $t('subtitle') }}
            </h2>
            <p class="my-4">
              {{ $t('description_text') }}
              <a href="http://mini-colours.co.uk" class="text-primary hover:underline">{{ $t('partner_link') }}</a>
              {{ $t('description_text_2') }}
            </p>
          </div>
          <div class="col-span-12 md:col-span-4">
            <a href="#submitAnchor" class="block">
              <UCard class="hover:shadow-lg transition-shadow duration-300">
                <div class="flex items-start space-x-4">
                  <div class="shrink-0">
                    <figure class="w-16 h-16">
                      <picture>
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-palette-100.webp"
                          type="image/webp"
                        />
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-palette-100.png"
                          type="image/png"
                        />
                        <nuxt-img
                          loading="lazy"
                          src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-palette-100.png"
                          :alt="$t('submit_card.alt_text')"
                          class="w-16 h-16"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div>
                    <h2 class="font-semibold text-lg">{{ $t('submit_card.title') }}</h2>
                    <p>
                      {{ $t('submit_card.description') }}
                    </p>
                  </div>
                </div>
              </UCard>
            </a>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <USeparator class="my-4" />
      </div>

      <!-- Search and Table Card -->
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <UCard class="mb-8">
          <template #header>
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
              <div class="flex items-center gap-2">
                <i class="fas fa-tire fa-spin text-primary text-2xl"></i>
                <h2 class="text-2xl font-semibold">{{ $t('search.card_title') }}</h2>
              </div>
              <div class="w-full md:w-96">
                <UInput
                  v-model="search"
                  type="text"
                  :placeholder="$t('search.placeholder')"
                  :aria-label="$t('search.placeholder')"
                  icon="i-fa6-solid-magnifying-glass"
                  class="w-full"
                />
              </div>
            </div>
          </template>

          <!-- Help Text -->
          <p class="text-base mb-4">
            {{ $t('search.help_text') }}
          </p>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th
                    v-for="header in tableHeaders"
                    :key="header.key"
                    class="text-left p-2 font-medium bg-muted"
                    :class="{ 'text-center': header.key === 'edit' }"
                  >
                    {{ header.title }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading State -->
                <template v-if="pending">
                  <tr v-for="i in 5" :key="'skeleton-' + i" class="border-b border-default last:border-0">
                    <td v-for="header in tableHeaders" :key="header.key" class="p-2">
                      <USkeleton class="h-4 w-3/4" />
                    </td>
                  </tr>
                </template>

                <!-- Empty State -->
                <template v-else-if="!filteredColors.length">
                  <tr>
                    <td :colspan="tableHeaders.length" class="text-center p-8">
                      <UAlert color="info" icon="i-fa6-solid-circle-info" :title="$t('states.no_colors')" />
                    </td>
                  </tr>
                </template>

                <!-- Data Rows -->
                <template v-else v-for="color in paginatedColors" :key="color.id">
                  <tr class="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <!-- Share Button -->
                    <td class="p-2">
                      <UButton
                        @click="shareColor(color)"
                        variant="ghost"
                        size="md"
                        :aria-label="`Share ${color.name || 'color'}`"
                      >
                        <i class="fas fa-share" aria-hidden="true"></i>
                      </UButton>
                    </td>

                    <!-- Color Name -->
                    <td class="p-2">
                      <NuxtLink :to="'/archive/colors/' + color.id" class="text-primary hover:underline">
                        {{ color.name || $t('states.unnamed_color') }}
                      </NuxtLink>
                    </td>

                    <!-- Color Swatch -->
                    <td class="p-2">
                      <div class="inline-block">
                        <img
                          v-if="color.hasSwatch && color.imageSwatch"
                          loading="lazy"
                          width="40"
                          height="40"
                          :alt="`${color.name || 'Color'} swatch`"
                          :src="color.imageSwatch"
                          class="w-10 h-10 object-cover rounded border border-default"
                        />

                        <div v-else class="w-10 h-10 flex items-center justify-center">
                          <i class="fa-regular fa-square-xmark text-4xl text-gray-400"></i>
                        </div>
                      </div>
                    </td>

                    <!-- Short Code -->
                    <td class="p-2">
                      <span v-if="color.shortCode && color.shortCode !== 'Unknown'" class="font-medium">
                        {{ color.shortCode }}
                      </span>
                      <UBadge v-else color="error" variant="soft">{{ $t('states.missing') }}</UBadge>
                    </td>

                    <!-- BMC Code -->
                    <td class="p-2">
                      <span v-if="color.code && color.code !== 'Unknown'" class="font-medium">
                        {{ color.code }}
                      </span>
                      <UBadge v-else color="error" variant="soft">{{ $t('states.missing') }}</UBadge>
                    </td>

                    <!-- Ditzler/PPG Code -->
                    <td class="p-2">
                      <span v-if="color.ditzlerPpgCode && color.ditzlerPpgCode !== 'Unknown'" class="font-medium">
                        {{ color.ditzlerPpgCode }}
                      </span>
                      <UBadge v-else color="error" variant="soft">{{ $t('states.missing') }}</UBadge>
                    </td>

                    <!-- Dulux Code -->
                    <td class="p-2">
                      <span v-if="color.duluxCode && color.duluxCode !== 'Unknown'" class="font-medium">
                        {{ color.duluxCode }}
                      </span>
                      <UBadge v-else color="error" variant="soft">{{ $t('states.missing') }}</UBadge>
                    </td>

                    <!-- Years Used -->
                    <td class="p-2">
                      <span v-if="color.years && color.years !== 'Unknown'" class="font-medium">
                        {{ Array.isArray(color.years) ? color.years.join(', ') : color.years }}
                      </span>
                      <UBadge v-else color="error" variant="soft">{{ $t('states.missing') }}</UBadge>
                    </td>

                    <!-- Edit Button -->
                    <td class="p-2 text-center">
                      <UButton
                        :to="'/contribute/color?color=' + color.id"
                        variant="ghost"
                        size="md"
                        :aria-label="`Edit ${color.name || 'color'}`"
                      >
                        <i class="fas fa-edit" aria-hidden="true"></i>
                      </UButton>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <template #footer v-if="filteredColors.length > itemsPerPage">
            <div class="flex justify-center">
              <div class="inline-flex rounded-md shadow-sm">
                <UButton
                  :disabled="currentPage === 1"
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  variant="outline"
                  class="rounded-r-none"
                >
                  «
                </UButton>
                <UButton variant="outline" class="rounded-none border-x-0" disabled>
                  {{ $t('pagination.page') }} {{ currentPage }} {{ $t('pagination.of') }} {{ totalPages }}
                </UButton>
                <UButton
                  :disabled="currentPage >= totalPages"
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  variant="outline"
                  class="rounded-l-none"
                >
                  »
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Submit New Color Section -->
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator id="submitAnchor" class="my-4">
          <span class="text-sm text-muted">{{ $t('submit_divider') }}</span>
        </USeparator>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <ColorSubmission />
      </div>

      <!-- Support Section -->
      <div class="col-span-12 md:col-span-10 md:col-start-2 text-center py-8">
        <USeparator class="my-4">
          <span class="text-sm text-muted">{{ $t('support_divider') }}</span>
        </USeparator>
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Color Picker",
    "description": "Find the perfect color for your Classic Mini with our comprehensive color picker.",
    "keywords": "Classic Mini colors, Mini Cooper paint codes, BMC color codes, Ditzler PPG codes, Dulux paint codes, vintage Mini colors, paint color database",
    "hero_title": "Color Picker",
    "breadcrumb_title": "Color Swatches",
    "main_heading": "Classic Mini Color Picker",
    "subtitle": "colors in our database",
    "description_text": "In an effort to make more information available, Classic Mini DIY has partnered with",
    "description_text_2": "to provide you with a comprehensive list of the colors used on the Classic Mini throughout the years.",
    "partner_link": "mini-colours.co.uk",
    "submit_card": {
      "title": "Submit a Color",
      "description": "Help expand our color database by submitting a new color",
      "alt_text": "Submit Color Icon"
    },
    "submit_divider": "Submit a New Color",
    "search": {
      "card_title": "Find your Color",
      "placeholder": "Search colors...",
      "help_text": "Use the search above to filter for any field in the table below instantly. Notice some data missing? Click the edit button to contribute!"
    },
    "table_headers": {
      "share": "Share",
      "color_name": "Color Name",
      "swatch": "Swatch",
      "short_code": "Short Code",
      "bmc_code": "BMC Code",
      "ditzler_ppg_code": "Ditzler/PPG Code",
      "dulux_code": "Dulux Code",
      "years_used": "Years Used",
      "edit": "Edit"
    },
    "states": {
      "no_colors": "No colors found matching your search.",
      "unnamed_color": "Unnamed Color",
      "missing": "Missing",
      "link_copied": "Link copied to clipboard!"
    },
    "pagination": {
      "page": "Page",
      "of": "of"
    },
    "share": {
      "title": "Classic Mini Color:",
      "text": "Check out this Classic Mini color:"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Color Picker | Classic Mini DIY",
      "og_description": "Find the perfect color for your Classic Mini with our comprehensive color picker and paint code reference.",
      "twitter_title": "Classic Mini Color Picker | Classic Mini DIY",
      "twitter_description": "Find the perfect color for your Classic Mini with our comprehensive color picker and paint code reference."
    }
  }
}
</i18n>
