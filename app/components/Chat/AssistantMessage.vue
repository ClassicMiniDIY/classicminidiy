<template>
  <div v-if="message && (hasVisibleContent || ranToolsWithoutAnswering)" class="group flex gap-3 sm:gap-4">
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
      <MarkdownText v-if="hasVisibleContent" :content="contentString" :show-cursor="isLoading" />

      <!--
        The run used its whole tool budget and stopped before writing an answer.
        Without this the turn renders as NOTHING — the question, the thinking
        dots vanishing, then silence, which is indistinguishable from a hang.
      -->
      <p v-else class="text-base-content/70">{{ t('ran_out_of_steps') }}</p>

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

  /**
   * A finished assistant turn that called tools but never wrote prose.
   *
   * Happens when `stopWhen: stepCountIs(...)` in the chat route halts the loop
   * on a tool call. Gated on `!isLoading` so a turn that is still streaming its
   * first token does not flash this — the thinking indicator owns that moment.
   */
  const ranToolsWithoutAnswering = computed(
    () =>
      !props.isLoading &&
      !hasVisibleContent.value &&
      (props.message?.parts ?? []).some((part: any) => typeof part?.type === 'string' && part.type.startsWith('tool-'))
  );

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
    "feedback_thanks": "Thanks",
    "ran_out_of_steps": "I looked that up but ran out of steps before finishing. Try asking again, or narrow the question."
  },
  "es": {
    "copy_button": "Copiar",
    "copied": "Copiado",
    "helpful": "Útil",
    "not_helpful": "No útil",
    "feedback_thanks": "Gracias",
    "ran_out_of_steps": "Lo busqué, pero me quedé sin pasos antes de terminar. Vuelve a preguntar o acota la pregunta."
  },
  "fr": {
    "copy_button": "Copier",
    "copied": "Copié",
    "helpful": "Utile",
    "not_helpful": "Pas utile",
    "feedback_thanks": "Merci",
    "ran_out_of_steps": "J'ai fait la recherche mais je n'ai pas pu terminer. Reposez la question ou précisez-la."
  },
  "de": {
    "copy_button": "Kopieren",
    "copied": "Kopiert",
    "helpful": "Hilfreich",
    "not_helpful": "Nicht hilfreich",
    "feedback_thanks": "Danke",
    "ran_out_of_steps": "Ich habe nachgeschlagen, konnte aber nicht fertig werden. Frage bitte erneut oder grenze sie ein."
  },
  "it": {
    "copy_button": "Copia",
    "copied": "Copiato",
    "helpful": "Utile",
    "not_helpful": "Non utile",
    "feedback_thanks": "Grazie",
    "ran_out_of_steps": "Ho fatto la ricerca ma non sono riuscito a concludere. Riprova o restringi la domanda."
  },
  "ja": {
    "copy_button": "コピー",
    "copied": "コピーしました",
    "helpful": "役に立った",
    "not_helpful": "役に立たなかった",
    "feedback_thanks": "ありがとうございます",
    "ran_out_of_steps": "調べましたが、完了する前に上限に達しました。もう一度、または範囲を絞ってお尋ねください。"
  },
  "ko": {
    "copy_button": "복사",
    "copied": "복사됨",
    "helpful": "도움이 됨",
    "not_helpful": "도움이 안 됨",
    "feedback_thanks": "감사합니다",
    "ran_out_of_steps": "조회했지만 완료하기 전에 한도에 도달했습니다. 다시 물어보거나 질문을 좁혀 주세요."
  },
  "pt": {
    "copy_button": "Copiar",
    "copied": "Copiado",
    "helpful": "Útil",
    "not_helpful": "Não útil",
    "feedback_thanks": "Obrigado",
    "ran_out_of_steps": "Fiz a busca, mas não consegui concluir. Pergunte de novo ou restrinja a pergunta."
  },
  "ru": {
    "copy_button": "Копировать",
    "copied": "Скопировано",
    "helpful": "Полезно",
    "not_helpful": "Бесполезно",
    "feedback_thanks": "Спасибо",
    "ran_out_of_steps": "Я выполнил поиск, но не успел закончить. Спросите ещё раз или уточните вопрос."
  },
  "zh": {
    "copy_button": "复制",
    "copied": "已复制",
    "helpful": "有帮助",
    "not_helpful": "没有帮助",
    "feedback_thanks": "谢谢",
    "ran_out_of_steps": "我查询了，但未能完成回答。请再问一次，或缩小问题范围。"
  }
}
</i18n>
