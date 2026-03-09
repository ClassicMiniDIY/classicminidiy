<template>
  <div class="mb-6 group flex flex-col items-end">
    <!-- Message content -->
    <div v-if="contentString" class="bg-primary text-white rounded-2xl px-4 py-3 max-w-[80%]">
      <div class="whitespace-pre-wrap">
        {{ contentString }}
      </div>
    </div>

    <!-- Action buttons (shown on hover) -->
    <div class="flex items-center gap-2 mt-2 opacity-0 transition-opacity group-hover:opacity-100 justify-end">
      <UButton @click="copyToClipboard(contentString)" size="xs" variant="ghost" color="neutral">
        <i class="fa-solid fa-copy h-3 w-3 mr-1" />
        {{ t('copy_button') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { HumanMessageProps } from '../../../data/models/chat';
  import { useStreamContext } from '~/composables/useStreamProvider';

  const { t } = useI18n();

  const props = defineProps<HumanMessageProps>();
  useStreamContext();

  // Helper function to extract content string from message
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

  const contentString = computed(() => getContentString(props.message.content));

  async function copyToClipboard(text: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
</script>

<i18n lang="json">
{
  "en": {
    "copy_button": "Copy"
  },
  "es": {
    "copy_button": "Copiar"
  },
  "fr": {
    "copy_button": "Copier"
  },
  "de": {
    "copy_button": "Kopieren"
  },
  "it": {
    "copy_button": "Copia"
  },
  "ja": {
    "copy_button": "コピー"
  },
  "ko": {
    "copy_button": "복사"
  },
  "pt": {
    "copy_button": "Copiar"
  },
  "ru": {
    "copy_button": "Копировать"
  },
  "zh": {
    "copy_button": "复制"
  }
}
</i18n>
