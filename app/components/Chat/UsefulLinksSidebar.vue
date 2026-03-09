<template>
  <div v-if="links && links.length > 0" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 pb-2 border-b border-default">
      <i class="fa-solid fa-link text-primary"></i>
      <h3 class="text-sm font-semibold">{{ $t('title') }}</h3>
      <span class="text-xs text-muted ml-auto">{{ links.length }}</span>
    </div>

    <!-- Links List -->
    <div class="space-y-3">
      <a
        v-for="(link, index) in links"
        :key="index"
        :href="addUtmParams(link.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="block p-3 rounded-lg bg-default hover:bg-muted transition-colors border border-default hover:border-muted group"
      >
        <div class="space-y-2">
          <!-- Title and Score -->
          <div class="flex items-start justify-between gap-2">
            <h4 class="font-medium text-sm text-primary group-hover:text-primary/80 line-clamp-2 leading-tight">
              {{ link.title }}
            </h4>
            <div class="shrink-0 flex items-center gap-1">
              <span class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {{ Math.round(link.score * 100) }}%
              </span>
              <i class="fa-solid fa-external-link text-xs text-muted"></i>
            </div>
          </div>

          <!-- Content Preview -->
          <p class="text-xs text-muted line-clamp-3 leading-relaxed">
            {{ link.content }}
          </p>

          <!-- URL -->
          <div class="text-xs text-muted truncate">
            {{ link.url }}
          </div>
        </div>
      </a>
    </div>

    <!-- Show More Indicator if many links -->
    <div v-if="links.length > 5" class="text-center pt-2 border-t border-default">
      <p class="text-xs text-muted">{{ $t('showing_results', { count: links.length }) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
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
        urlObj.searchParams.set('utm_campaign', 'useful_links_sidebar');
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
    "title": "Useful Links",
    "showing_results": "Showing {count} results"
  },
  "es": {
    "title": "Enlaces Útiles",
    "showing_results": "Mostrando {count} resultados"
  },
  "fr": {
    "title": "Liens Utiles",
    "showing_results": "Affichage de {count} résultats"
  },
  "de": {
    "title": "Nützliche Links",
    "showing_results": "Zeige {count} Ergebnisse"
  },
  "it": {
    "title": "Link Utili",
    "showing_results": "Mostrando {count} risultati"
  },
  "ja": {
    "title": "有用なリンク",
    "showing_results": "{count}件の結果を表示"
  },
  "ko": {
    "title": "유용한 링크",
    "showing_results": "{count}개 결과 표시"
  },
  "pt": {
    "title": "Links Úteis",
    "showing_results": "Mostrando {count} resultados"
  },
  "ru": {
    "title": "Полезные ссылки",
    "showing_results": "Показано {count} результатов"
  },
  "zh": {
    "title": "有用链接",
    "showing_results": "显示 {count} 个结果"
  }
}
</i18n>

<style scoped>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-clamp: 2;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-clamp: 3;
  }
</style>
