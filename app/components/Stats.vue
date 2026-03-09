<script lang="ts" setup>
  const { t } = useI18n();
  const { data: stats } = await useFetch('/api/youtube/stats');
</script>

<template>
  <div
    class="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-default rounded-lg shadow-lg bg-default border border-default"
  >
    <!-- Views Stat -->
    <div class="flex-1 p-6 text-center lg:text-left">
      <div class="flex items-center justify-center lg:justify-start gap-4">
        <div class="text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="inline-block h-8 w-8 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            ></path>
          </svg>
        </div>
        <div>
          <div class="text-sm text-muted">{{ t('all_time_views') }}</div>
          <div class="text-2xl font-bold text-primary" v-if="stats && stats.views">{{ stats?.views }}</div>
          <div class="text-xs text-muted">{{ t('since_2015') }}</div>
        </div>
      </div>
    </div>

    <!-- Subscribers Stat -->
    <div class="flex-1 p-6 text-center lg:text-left">
      <div class="flex items-center justify-center lg:justify-start gap-4">
        <div class="text-secondary">
          <i class="fad fa-user text-3xl"></i>
        </div>
        <div>
          <div class="text-sm text-muted">{{ t('subscribers') }}</div>
          <div class="text-2xl font-bold text-secondary" v-if="stats && stats.subscribers">
            {{ stats?.subscribers }}
          </div>
          <div class="text-xs text-muted">{{ t('across_world') }}</div>
        </div>
      </div>
    </div>

    <!-- Videos Stat -->
    <div class="flex-1 p-6 text-center lg:text-left">
      <div class="flex items-center justify-center lg:justify-start gap-4">
        <div class="text-info">
          <i class="fad fa-video-camera text-3xl"></i>
        </div>
        <div>
          <div class="text-2xl font-bold text-info" v-if="stats && stats.videos">{{ stats?.videos }}</div>
          <div class="text-sm text-muted">{{ t('videos') }}</div>
          <div class="text-xs text-muted">{{ t('since_2015') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "all_time_views": "All Time Views",
    "subscribers": "Subscribers",
    "across_world": "across the world",
    "videos": "Videos",
    "since_2015": "since 2015"
  },
  "de": {
    "all_time_views": "Gesamtaufrufe",
    "subscribers": "Abonnenten",
    "across_world": "weltweit",
    "videos": "Videos",
    "since_2015": "seit 2015"
  },
  "es": {
    "all_time_views": "Visualizaciones Totales",
    "subscribers": "Suscriptores",
    "across_world": "en todo el mundo",
    "videos": "Videos",
    "since_2015": "desde 2015"
  },
  "fr": {
    "all_time_views": "Vues Totales",
    "subscribers": "Abonnés",
    "across_world": "à travers le monde",
    "videos": "Vidéos",
    "since_2015": "depuis 2015"
  },
  "it": {
    "all_time_views": "Visualizzazioni Totali",
    "subscribers": "Iscritti",
    "across_world": "in tutto il mondo",
    "videos": "Video",
    "since_2015": "dal 2015"
  },
  "ja": {
    "all_time_views": "総再生回数",
    "subscribers": "登録者数",
    "across_world": "世界中から",
    "videos": "動画",
    "since_2015": "2015年から"
  },
  "ko": {
    "all_time_views": "총 조회수",
    "subscribers": "구독자",
    "across_world": "전 세계",
    "videos": "동영상",
    "since_2015": "2015년부터"
  },
  "pt": {
    "all_time_views": "Visualizações Totais",
    "subscribers": "Inscritos",
    "across_world": "ao redor do mundo",
    "videos": "Vídeos",
    "since_2015": "desde 2015"
  },
  "ru": {
    "all_time_views": "Всего просмотров",
    "subscribers": "Подписчиков",
    "across_world": "по всему миру",
    "videos": "Видео",
    "since_2015": "с 2015 года"
  },
  "zh": {
    "all_time_views": "总观看次数",
    "subscribers": "订阅者",
    "across_world": "全球范围",
    "videos": "视频",
    "since_2015": "自2015年起"
  }
}
</i18n>
