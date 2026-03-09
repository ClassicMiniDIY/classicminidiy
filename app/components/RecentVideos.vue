<script setup lang="ts">
  const { t } = useI18n();
  const { data: videos, status, error } = await useFetch('/api/youtube/videos');
</script>

<template>
  <div class="col-span-12">
    <h3 class="font-bold text-3xl text-center pb-5">{{ t('title') }}</h3>
  </div>

  <div v-if="status === 'pending'" class="col-span-12 md:col-span-3" v-for="item in 3"></div>
  <div v-else-if="error" class="col-span-12">
    <p>{{ t('error_message') }}</p>
  </div>

  <template v-else-if="videos">
    <UCard v-for="video in videos" :key="video.videoUrl" class="col-span-12 md:col-span-4">
      <template #header>
        <nuxt-picture :src="video.thumbnails.maxres" alt="Video Thumbnail" class="w-full" />
      </template>
      <h2 class="font-semibold text-lg">{{ video.title }}</h2>
      <p class="text-sm text-muted">{{ t('published_on') }} {{ video.publishedOn }}</p>
      <template #footer>
        <div class="flex justify-end">
          <UButton :to="video.videoUrl" target="_blank" color="primary">{{ t('watch_button') }}</UButton>
        </div>
      </template>
    </UCard>
  </template>
</template>

<i18n lang="json">
{
  "de": {
    "title": "Neueste Videos",
    "error_message": "YouTube-Daten konnten nicht geladen werden",
    "published_on": "Veröffentlicht am",
    "watch_button": "Ansehen"
  },
  "en": {
    "title": "Recent Videos",
    "error_message": "Unable to load youtube data",
    "published_on": "Published on",
    "watch_button": "Watch"
  },
  "es": {
    "title": "Videos Recientes",
    "error_message": "No se pudieron cargar los datos de youtube",
    "published_on": "Publicado el",
    "watch_button": "Ver"
  },
  "fr": {
    "title": "Vidéos récentes",
    "error_message": "Impossible de charger les données youtube",
    "published_on": "Publié le",
    "watch_button": "Regarder"
  },
  "it": {
    "title": "Video recenti",
    "error_message": "Impossibile caricare i dati di YouTube",
    "published_on": "Pubblicato il",
    "watch_button": "Guarda"
  },
  "ja": {
    "title": "最新動画",
    "error_message": "YouTubeデータを読み込めませんでした",
    "published_on": "公開日",
    "watch_button": "視聴"
  },
  "ko": {
    "title": "최신 동영상",
    "error_message": "YouTube 데이터를 불러올 수 없습니다",
    "published_on": "게시일",
    "watch_button": "시청하기"
  },
  "pt": {
    "title": "Vídeos Recentes",
    "error_message": "Não foi possível carregar dados do youtube",
    "published_on": "Publicado em",
    "watch_button": "Assistir"
  },
  "ru": {
    "title": "Последние видео",
    "error_message": "Не удается загрузить данные YouTube",
    "published_on": "Опубликовано",
    "watch_button": "Смотреть"
  },
  "zh": {
    "title": "最新视频",
    "error_message": "无法加载YouTube数据",
    "published_on": "发布于",
    "watch_button": "观看"
  }
}
</i18n>

<style lang="scss">
  .test {
    color: inherit;
  }
</style>
