<template>
  <div v-if="message && hasVisibleContent" class="group flex gap-3 sm:gap-4">
    <!-- Assistant identity. The reply itself stays unboxed so the answer, not
         the chrome, carries the visual weight. -->
    <div
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary"
      aria-hidden="true"
    >
      <i class="fas fa-comments"></i>
    </div>

    <!-- min-w-0 is load-bearing: without it this flex child refuses to shrink
         below its content width and long words push the column off-screen. -->
    <div class="min-w-0 flex-1">
      <MarkdownText :content="contentString" :show-cursor="isLoading" />

      <!--
        Actions are revealed on hover on pointer devices, but stay visible below
        the `sm` breakpoint: there is no hover on touch, so a hover-only control
        is simply unreachable on a phone. `focus-within` keeps them reachable by
        keyboard on every breakpoint.
      -->
      <div
        class="mt-1.5 flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      >
        <button
          type="button"
          @click="copyToClipboard(contentString)"
          class="btn btn-ghost btn-xs gap-1.5 font-normal text-base-content/60"
        >
          <i :class="justCopied ? 'fas fa-check' : 'fas fa-copy'" aria-hidden="true"></i>
          {{ justCopied ? t('copied') : t('copy_button') }}
        </button>

        <!--
          Was this answer any good? The only instrument that can tell a wrong
          answer from a right one, and the baseline the rebuilt assistant has to
          beat. Rating is one-shot and never sends message text — see the track()
          calls below.
        -->
        <template v-if="!rating">
          <button
            type="button"
            @click="rate('up')"
            :aria-label="t('helpful')"
            :title="t('helpful')"
            class="btn btn-ghost btn-xs text-base-content/60"
          >
            <i class="far fa-thumbs-up" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            @click="rate('down')"
            :aria-label="t('not_helpful')"
            :title="t('not_helpful')"
            class="btn btn-ghost btn-xs text-base-content/60"
          >
            <i class="far fa-thumbs-down" aria-hidden="true"></i>
          </button>
        </template>
        <span v-else class="px-1 text-xs text-base-content/50" role="status">
          <i :class="rating === 'up' ? 'fas fa-thumbs-up' : 'fas fa-thumbs-down'" aria-hidden="true"></i>
          {{ t('feedback_thanks') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { UIMessage } from 'ai';
  import { messageText } from '~/utils/chatMessages';

  import MarkdownText from './MarkdownText.vue';
  const { t } = useI18n();
  const { track } = useAnalytics();
  // `threadId` arrives as a prop rather than through inject(): the conversation
  // id is owned by ChatWindow now, and an explicit prop is one less piece of
  // hidden coupling in a component that only needs it to label a rating.
  const props = defineProps<{ message?: UIMessage; isLoading?: boolean; threadId?: string }>();

  const contentString = computed(() => messageText(props.message));

  const hasVisibleContent = computed(() => contentString.value.trim().length > 0);

  const justCopied = ref(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  const copyToClipboard = async (text: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      track('assistant_message_copied', { message_length: text.length });
      justCopied.value = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        justCopied.value = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  onUnmounted(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  /**
   * Per-reply rating.
   *
   * Deliberately captures NO message text — only the rating, which reply it was,
   * and how long the answer ran. Joining on `thread_id` against the server-side
   * `chat_run_completed` event (server/utils/chatUsage.ts) is what makes it
   * useful: that event carries `tools_called`, so a run rated down with an empty
   * tool list is a different failure from one rated down after the right tool
   * answered.
   *
   * One rating per reply. Not undoable, because a rating that can be toggled
   * invites fiddling and the signal is weak enough already at this volume.
   */
  const rating = ref<'up' | 'down' | null>(null);

  const rate = (value: 'up' | 'down') => {
    if (rating.value) return;
    rating.value = value;
    track('chat_reply_rated', {
      rating: value,
      thread_id: props.threadId ?? null,
      message_id: props.message?.id ?? null,
      reply_length: contentString.value.length,
    });
  };
</script>

<i18n lang="json">
{
  "en": {
    "copy_button": "Copy",
    "copied": "Copied",
    "helpful": "Helpful",
    "not_helpful": "Not helpful",
    "feedback_thanks": "Thanks"
  },
  "es": {
    "copy_button": "Copiar",
    "copied": "Copiado",
    "helpful": "Útil",
    "not_helpful": "No útil",
    "feedback_thanks": "Gracias"
  },
  "fr": {
    "copy_button": "Copier",
    "copied": "Copié",
    "helpful": "Utile",
    "not_helpful": "Pas utile",
    "feedback_thanks": "Merci"
  },
  "de": {
    "copy_button": "Kopieren",
    "copied": "Kopiert",
    "helpful": "Hilfreich",
    "not_helpful": "Nicht hilfreich",
    "feedback_thanks": "Danke"
  },
  "it": {
    "copy_button": "Copia",
    "copied": "Copiato",
    "helpful": "Utile",
    "not_helpful": "Non utile",
    "feedback_thanks": "Grazie"
  },
  "ja": {
    "copy_button": "コピー",
    "copied": "コピーしました",
    "helpful": "役に立った",
    "not_helpful": "役に立たなかった",
    "feedback_thanks": "ありがとうございます"
  },
  "ko": {
    "copy_button": "복사",
    "copied": "복사됨",
    "helpful": "도움이 됨",
    "not_helpful": "도움이 안 됨",
    "feedback_thanks": "감사합니다"
  },
  "pt": {
    "copy_button": "Copiar",
    "copied": "Copiado",
    "helpful": "Útil",
    "not_helpful": "Não útil",
    "feedback_thanks": "Obrigado"
  },
  "ru": {
    "copy_button": "Копировать",
    "copied": "Скопировано",
    "helpful": "Полезно",
    "not_helpful": "Бесполезно",
    "feedback_thanks": "Спасибо"
  },
  "zh": {
    "copy_button": "复制",
    "copied": "已复制",
    "helpful": "有帮助",
    "not_helpful": "没有帮助",
    "feedback_thanks": "谢谢"
  }
}
</i18n>
