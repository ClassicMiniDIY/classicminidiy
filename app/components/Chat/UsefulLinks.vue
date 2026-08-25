<template>
  <!--
    NOTE: this component previously styled itself with `bg-default`,
    `border-default`, `bg-muted` and `text-muted` — Nuxt UI semantic classes
    that left with `@nuxt/ui`. Nothing in main.css defines them, so the cards
    had no background, no border and no muted text. These are daisyUI tokens.
  -->
  <div v-if="links && links.length > 0" class="rounded-xl border border-base-300 bg-base-200/50 p-4">
    <div class="mb-3 flex items-center gap-2">
      <i class="fas fa-link text-primary" aria-hidden="true"></i>
      <h3 class="text-sm font-semibold">{{ t('title') }}</h3>
      <span class="ml-auto text-xs text-base-content/50">{{ links.length }}</span>
    </div>
    <div class="space-y-2">
      <a
        v-for="(link, index) in links"
        :key="index"
        :href="addUtmParams(link.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="block rounded-lg border border-base-300 bg-base-100 p-3 transition-colors hover:border-primary/40"
        @click="trackOutbound({ destination: link.url, label: link.title, group: 'chat_useful_link' })"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="line-clamp-2 text-sm font-medium text-primary">
              {{ link.title }}
            </div>
            <div class="mt-1 line-clamp-2 text-xs text-base-content/60">
              {{ link.content }}
            </div>
            <div class="mt-1 truncate text-xs text-base-content/40">
              {{ link.url }}
            </div>
          </div>
          <i class="fas fa-arrow-up-right-from-square shrink-0 text-xs text-base-content/40" aria-hidden="true"></i>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const { trackOutbound } = useAnalytics();

  interface UsefulLink {
    url: string;
    title: string;
    content: string;
    score: number;
  }

  interface Props {
    links: UsefulLink[];
  }

  defineProps<Props>();

  // Add UTM parameters to URLs for tracking
  const addUtmParams = (url: string): string => {
    try {
      const urlObj = new URL(url);

      // Only add UTM params if they don't already exist
      if (!urlObj.searchParams.has('utm_source')) {
        urlObj.searchParams.set('utm_source', 'diy_chat_bot');
        urlObj.searchParams.set('utm_medium', 'chat');
        urlObj.searchParams.set('utm_campaign', 'useful_links');
        urlObj.searchParams.set('utm_content', 'search_results');
      }

      return urlObj.toString();
    } catch (error) {
      // If URL parsing fails, return original URL
      return url;
    }
  };
</script>

<i18n lang="json">
{
  "en": {
    "title": "Useful Links"
  },
  "es": {
    "title": "Enlaces Útiles"
  },
  "fr": {
    "title": "Liens Utiles"
  },
  "de": {
    "title": "Nützliche Links"
  },
  "it": {
    "title": "Collegamenti utili"
  },
  "ja": {
    "title": "有用なリンク"
  },
  "ko": {
    "title": "유용한 링크"
  },
  "pt": {
    "title": "Links Úteis"
  },
  "ru": {
    "title": "Полезные ссылки"
  },
  "zh": {
    "title": "有用链接"
  }
}
</i18n>

<style scoped>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-clamp: 2; /* Standard property for compatibility */
  }
</style>
