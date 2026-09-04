<template>
  <div
    v-if="videos && videos.length > 0"
    :class="variant === 'rail' ? 'space-y-4' : 'rounded-xl border border-base-300 bg-base-200/50 p-4'"
  >
    <div class="flex items-center gap-2" :class="variant === 'rail' ? 'border-b border-base-300 pb-2' : 'mb-3'">
      <i class="fab fa-youtube text-error" aria-hidden="true"></i>
      <h3 class="text-sm font-semibold">{{ t('title') }}</h3>
      <span class="ml-auto text-xs text-base-content/50">{{ videos.length }}</span>
    </div>

    <div :class="variant === 'rail' ? 'space-y-3' : 'space-y-2'">
      <a
        v-for="video in videos"
        :key="video.videoId"
        :href="video.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group block overflow-hidden rounded-lg border border-base-300 bg-base-100 transition-colors hover:border-error/40"
        @click="trackOutbound({ destination: video.url, label: video.title, group: 'chat_video' })"
      >
        <!--
          Plain <img>, not <NuxtImg>. YouTube thumbnails come from `i.ytimg.com`,
          which is not in `image.domains` — and an unlisted host is a SILENT
          unoptimized pass-through, not an error (see CLAUDE.md). Rather than add
          a third-party host to the allowlist for images we neither store nor
          control, this stays a plain lazy <img> and is honest about it.
        -->
        <div class="relative aspect-video w-full overflow-hidden bg-base-300">
          <img
            v-if="video.thumbnail"
            :src="video.thumbnail"
            :alt="video.title"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover"
          />
          <span
            class="absolute inset-0 flex items-center justify-center bg-base-content/10 transition-colors group-hover:bg-base-content/20"
            aria-hidden="true"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-error text-white shadow-md">
              <i class="fas fa-play text-xs"></i>
            </span>
          </span>
        </div>

        <div class="p-3">
          <div class="line-clamp-2 text-sm font-medium leading-tight text-primary">
            {{ video.title }}
          </div>
          <div class="mt-1 flex items-center gap-1.5 text-xs text-base-content/50">
            <i class="fab fa-youtube" aria-hidden="true"></i>
            <span>{{ t('channel') }}</span>
            <span v-if="publishedLabel(video.publishedAt)" aria-hidden="true">·</span>
            <span v-if="publishedLabel(video.publishedAt)">{{ publishedLabel(video.publishedAt) }}</span>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * Cole's videos, beside the answer.
   *
   * ONE component for both placements, unlike `UsefulLinks` / `UsefulLinksSidebar`
   * which are two near-copies that have already drifted. A video card is mostly
   * a thumbnail, and a thumbnail wants the same treatment in the rail and inline
   * — so the difference is a `variant` prop and nothing else.
   *
   * Fed by shape-matching `output.videos` in ChatWindow.vue. `video-search`
   * deliberately returns `videos` rather than `results` so these never leak into
   * the Useful Links rail, which matches on `results`.
   */
  const { t, locale } = useI18n();
  const { trackOutbound } = useAnalytics();

  interface ChatVideo {
    videoId: string;
    title: string;
    url: string;
    thumbnail: string;
    publishedAt: string;
    score: number;
  }

  withDefaults(
    defineProps<{
      videos: ChatVideo[];
      /** `rail` sits in the desktop aside; `inline` falls under the transcript below `lg`. */
      variant?: 'rail' | 'inline';
    }>(),
    { variant: 'inline' }
  );

  /**
   * Month and year, in the reader's locale.
   *
   * Returns '' rather than throwing on an unparseable date. The value comes
   * from a tool result, and a date that fails to parse must cost a line of
   * metadata, never the whole card.
   */
  function publishedLabel(published: string): string {
    if (!published) return '';
    const date = new Date(published);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short' }).format(date);
    } catch {
      return '';
    }
  }
</script>

<i18n lang="json">
{
  "en": { "title": "Watch on Classic Mini DIY", "channel": "Classic Mini DIY" },
  "es": { "title": "Ver en Classic Mini DIY", "channel": "Classic Mini DIY" },
  "fr": { "title": "Voir sur Classic Mini DIY", "channel": "Classic Mini DIY" },
  "de": { "title": "Ansehen auf Classic Mini DIY", "channel": "Classic Mini DIY" },
  "it": { "title": "Guarda su Classic Mini DIY", "channel": "Classic Mini DIY" },
  "ja": { "title": "Classic Mini DIY で見る", "channel": "Classic Mini DIY" },
  "ko": { "title": "Classic Mini DIY에서 보기", "channel": "Classic Mini DIY" },
  "pt": { "title": "Assista no Classic Mini DIY", "channel": "Classic Mini DIY" },
  "ru": { "title": "Смотреть на Classic Mini DIY", "channel": "Classic Mini DIY" },
  "zh": { "title": "在 Classic Mini DIY 观看", "channel": "Classic Mini DIY" }
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
</style>
