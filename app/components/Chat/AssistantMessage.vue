<template>
  <div v-if="message && !isToolResult && hasVisibleContent" class="group flex gap-3 sm:gap-4">
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
        <time v-if="message?.created_at" class="text-xs text-base-content/40">{{
          formatTime(message.created_at)
        }}</time>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { AssistantMessageProps } from '../../../data/models/chat';
  import { useStreamContext } from '~/composables/useStreamProvider';

  import MarkdownText from './MarkdownText.vue';
  const { t } = useI18n();
  const { track } = useAnalytics();
  const props = defineProps<AssistantMessageProps>();

  useStreamContext();

  function getContentString(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n');
    }
    return '';
  }

  const contentString = computed(() => (props.message ? getContentString(props.message.content) : ''));

  const isToolResult = computed(() => props.message?.type === 'tool');

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

  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };
</script>

<i18n lang="json">
{
  "en": { "copy_button": "Copy", "copied": "Copied" },
  "es": { "copy_button": "Copiar", "copied": "Copiado" },
  "fr": { "copy_button": "Copier", "copied": "Copié" },
  "de": { "copy_button": "Kopieren", "copied": "Kopiert" },
  "it": { "copy_button": "Copia", "copied": "Copiato" },
  "ja": { "copy_button": "コピー", "copied": "コピーしました" },
  "ko": { "copy_button": "복사", "copied": "복사됨" },
  "pt": { "copy_button": "Copiar", "copied": "Copiado" },
  "ru": { "copy_button": "Копировать", "copied": "Скопировано" },
  "zh": { "copy_button": "复制", "copied": "已复制" }
}
</i18n>
