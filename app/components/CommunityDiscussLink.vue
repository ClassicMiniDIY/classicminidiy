<script lang="ts" setup>
  /**
   * "Discuss this on the community": one forum topic per knowledgebase page.
   * Design: docs/plans/2026-10-05-community-discuss-links.md.
   *
   * Renders only on a path in COMMUNITY_DISCUSS_PAGES, so it is safe to drop
   * into shared chrome (ToolFooter does). The link goes to the server route,
   * which finds or creates the topic and redirects; with the forum key unset it
   * redirects to the forum search. `nofollow` keeps crawlers off the create path.
   */
  import { communityDiscussKeyForPath } from '~~/shared/utils/communityDiscuss';

  const { t } = useI18n();
  const route = useRoute();
  const { trackOutbound } = useAnalytics();

  const pageKey = computed(() => communityDiscussKeyForPath(route.path));
  const href = computed(() => (pageKey.value ? `/api/community/discuss?page=${pageKey.value}` : ''));
</script>

<template>
  <a
    v-if="pageKey"
    :href="href"
    target="_blank"
    rel="nofollow noopener"
    class="mt-4 flex items-center gap-3.5 rounded-box border border-base-300 bg-base-100 px-5 py-4 transition-colors hover:border-secondary"
    data-testid="community-discuss-link"
    @click="trackOutbound({ destination: href, label: pageKey ?? undefined, group: 'community_discuss' })"
  >
    <i class="fas fa-comments text-lg text-secondary" aria-hidden="true"></i>
    <span>
      <span class="block text-sm font-semibold">{{ t('title') }} &rarr;</span>
      <span class="mt-0.5 block text-[13px] opacity-75">{{ t('body') }}</span>
    </span>
  </a>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Discuss this on the community",
    "body": "Ask a question or share what you know in the Classic Mini DIY Community forum."
  },
  "es": {
    "title": "Comentarlo en la comunidad",
    "body": "Haz una pregunta o comparte lo que sabes en el foro Classic Mini DIY Community."
  },
  "fr": {
    "title": "En discuter sur la communauté",
    "body": "Posez une question ou partagez vos connaissances sur le forum Classic Mini DIY Community."
  },
  "de": {
    "title": "In der Community diskutieren",
    "body": "Stelle eine Frage oder teile dein Wissen im Forum Classic Mini DIY Community."
  },
  "it": {
    "title": "Discutine nella community",
    "body": "Fai una domanda o condividi ciò che sai nel forum Classic Mini DIY Community."
  },
  "pt": {
    "title": "Discutir na comunidade",
    "body": "Faça uma pergunta ou compartilhe o que sabe no fórum Classic Mini DIY Community."
  },
  "ru": {
    "title": "Обсудить в сообществе",
    "body": "Задайте вопрос или поделитесь знаниями на форуме Classic Mini DIY Community."
  },
  "ja": {
    "title": "コミュニティで話し合う",
    "body": "Classic Mini DIY Community フォーラムで質問したり、知識を共有したりできます。"
  },
  "zh": {
    "title": "在社区中讨论",
    "body": "在 Classic Mini DIY Community 论坛提问或分享你的经验。"
  },
  "ko": {
    "title": "커뮤니티에서 토론하기",
    "body": "Classic Mini DIY Community 포럼에서 질문하거나 알고 있는 내용을 공유하세요."
  }
}
</i18n>
