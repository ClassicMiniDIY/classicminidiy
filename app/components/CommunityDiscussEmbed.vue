<script lang="ts" setup>
  /**
   * The forum discussion for a knowledgebase page, shown inline.
   * Design: docs/plans/2026-10-05-community-discuss-links.md ("Comment embeds").
   *
   * - Embeds only a topic that already exists. The topic id comes from
   *   GET /api/community/discuss/topic, which only reads KV; a miss renders
   *   nothing and the page keeps just the "Discuss this" link. A page view never
   *   creates a topic and never calls the forum API.
   * - Client-only: the fetch runs in onMounted, so SSR and the first client
   *   render agree (nothing), and crawlers get no iframe.
   * - The iframe loads only when the reader presses "Show the discussion": no
   *   request reaches the forum before that.
   * - Height follows the forum's `discourse-resize` postMessage, accepted only
   *   from the forum origin and from this iframe (app/utils/discourseEmbed.ts).
   */
  import type { CommunityDiscussKey } from '~~/shared/utils/communityDiscuss';
  import {
    DISCOURSE_EMBED_MIN_HEIGHT,
    discourseEmbedOrigin,
    discourseEmbedSrc,
    readDiscourseEmbedMessage,
  } from '~/utils/discourseEmbed';

  const props = defineProps<{ pageKey: CommunityDiscussKey }>();

  const { t } = useI18n();
  const runtimeConfig = useRuntimeConfig();
  const { isDark } = useColorMode();
  const { track } = useAnalytics();

  const forumOrigin = computed(() => discourseEmbedOrigin(runtimeConfig.public.discourseUrl));
  const topicId = ref<number | null>(null);
  const isOpen = ref(false);
  const frame = ref<HTMLIFrameElement | null>(null);
  const frameHeight = ref(DISCOURSE_EMBED_MIN_HEIGHT * 2);

  const frameSrc = computed(() =>
    topicId.value ? discourseEmbedSrc(forumOrigin.value, topicId.value, isDark.value) : ''
  );

  function onMessage(event: MessageEvent) {
    const message = readDiscourseEmbedMessage(event, forumOrigin.value, frame.value?.contentWindow ?? null);
    if (!message) return;
    if (message.type === 'resize') {
      frameHeight.value = message.height;
    } else if (frame.value) {
      const frameTop = frame.value.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: frameTop + message.top, behavior: 'smooth' });
    }
  }

  function showDiscussion() {
    isOpen.value = true;
    track('community_discussion_opened', { page: props.pageKey });
  }

  onMounted(async () => {
    window.addEventListener('message', onMessage);
    try {
      const res = await $fetch<{ topicId: unknown }>('/api/community/discuss/topic', {
        query: { page: props.pageKey },
      });
      const id = Number(res?.topicId);
      topicId.value = Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch {
      topicId.value = null;
    }
  });

  onBeforeUnmount(() => window.removeEventListener('message', onMessage));
</script>

<template>
  <section
    v-if="topicId"
    class="mt-4 overflow-hidden rounded-box border border-base-300 bg-base-100"
    data-testid="community-discuss-embed"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div class="flex items-center gap-3.5">
        <i class="fas fa-comments text-lg text-secondary" aria-hidden="true"></i>
        <div>
          <h2 class="text-sm font-semibold">{{ t('heading') }}</h2>
          <p v-if="!isOpen" class="mt-0.5 text-[13px] opacity-75">{{ t('hint') }}</p>
        </div>
      </div>
      <button
        v-if="!isOpen"
        type="button"
        class="btn btn-sm btn-outline btn-secondary"
        data-testid="community-discuss-show"
        @click="showDiscussion"
      >
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
        {{ t('show') }}
      </button>
    </div>
    <iframe
      v-if="isOpen"
      ref="frame"
      :src="frameSrc"
      :title="t('frame_title')"
      :style="{ height: `${frameHeight}px` }"
      class="block w-full border-0 border-t border-base-300"
      scrolling="no"
      referrerpolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      data-testid="community-discuss-frame"
    ></iframe>
  </section>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Community discussion",
    "hint": "Replies from the Classic Mini DIY Community forum.",
    "show": "Show the discussion",
    "frame_title": "Community forum discussion of this page"
  },
  "es": {
    "heading": "Conversación de la comunidad",
    "hint": "Respuestas del foro Classic Mini DIY Community.",
    "show": "Mostrar la conversación",
    "frame_title": "Conversación del foro de la comunidad sobre esta página"
  },
  "fr": {
    "heading": "Discussion de la communauté",
    "hint": "Réponses du forum Classic Mini DIY Community.",
    "show": "Afficher la discussion",
    "frame_title": "Discussion du forum de la communauté sur cette page"
  },
  "de": {
    "heading": "Community-Diskussion",
    "hint": "Antworten aus dem Forum Classic Mini DIY Community.",
    "show": "Diskussion anzeigen",
    "frame_title": "Forumsdiskussion der Community zu dieser Seite"
  },
  "it": {
    "heading": "Discussione della community",
    "hint": "Risposte dal forum Classic Mini DIY Community.",
    "show": "Mostra la discussione",
    "frame_title": "Discussione del forum della community su questa pagina"
  },
  "pt": {
    "heading": "Discussão da comunidade",
    "hint": "Respostas do fórum Classic Mini DIY Community.",
    "show": "Mostrar a discussão",
    "frame_title": "Discussão do fórum da comunidade sobre esta página"
  },
  "ru": {
    "heading": "Обсуждение в сообществе",
    "hint": "Ответы с форума Classic Mini DIY Community.",
    "show": "Показать обсуждение",
    "frame_title": "Обсуждение этой страницы на форуме сообщества"
  },
  "ja": {
    "heading": "コミュニティでの話し合い",
    "hint": "Classic Mini DIY Community フォーラムからの返信です。",
    "show": "話し合いを表示",
    "frame_title": "このページについてのコミュニティフォーラムでの話し合い"
  },
  "zh": {
    "heading": "社区讨论",
    "hint": "来自 Classic Mini DIY Community 论坛的回复。",
    "show": "显示讨论",
    "frame_title": "社区论坛中关于此页面的讨论"
  },
  "ko": {
    "heading": "커뮤니티 토론",
    "hint": "Classic Mini DIY Community 포럼의 답글입니다.",
    "show": "토론 보기",
    "frame_title": "이 페이지에 대한 커뮤니티 포럼 토론"
  }
}
</i18n>
