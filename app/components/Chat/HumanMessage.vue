<template>
  <div class="group flex flex-col items-end">
    <!-- `text-primary-content` rather than a hardcoded `text-white`: the light
         theme's primary is a mid olive, and white on it fails contrast. -->
    <div
      v-if="contentString"
      class="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-primary-content sm:max-w-[80%]"
      style="overflow-wrap: anywhere"
    >
      <div class="whitespace-pre-wrap">{{ contentString }}</div>
    </div>

    <div
      class="mt-1 flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
    >
      <button
        type="button"
        @click="copyToClipboard(contentString)"
        class="btn btn-ghost btn-xs gap-1.5 font-normal text-base-content/60"
      >
        <i :class="justCopied ? 'fas fa-check' : 'fas fa-copy'" aria-hidden="true"></i>
        {{ justCopied ? t('copied') : t('copy_button') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { UIMessage } from 'ai';
  import { messageText } from '~/utils/chatMessages';

  const { t } = useI18n();

  const props = defineProps<{ message?: UIMessage; isLoading?: boolean }>();

  const contentString = computed(() => messageText(props.message));

  const justCopied = ref(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyToClipboard(text: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      justCopied.value = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        justCopied.value = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  onUnmounted(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });
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
