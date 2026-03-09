<template>
  <!-- Floating Chat Input -->
  <div class="fixed bottom-6 right-6 z-50 max-w-md w-full px-4">
    <div class="bg-default rounded-2xl shadow-xl border border-default p-4">
      <form @submit.prevent="handleSubmit" class="relative">
        <div class="flex items-end gap-3 bg-muted rounded-2xl p-3 shadow-sm border border-default">
          <textarea
            ref="inputRef"
            v-model="input"
            @keydown="handleInputKeyDown"
            :placeholder="t('placeholder')"
            class="flex-1 bg-transparent resize-none outline-none min-h-[1.5rem] max-h-32 placeholder:text-muted"
            rows="1"
          ></textarea>

          <UButton type="submit" size="sm" color="primary" square :disabled="!input.trim()">
            <i class="fa-solid fa-paper-plane"></i>
          </UButton>
        </div>
      </form>

      <!-- Small helper text -->
      <div class="flex justify-center mt-2">
        <span class="text-xs text-muted">
          <i class="fa-solid fa-comments text-xs mr-1"></i>
          {{ t('helper_text') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const input = ref('');
  const inputRef = ref<HTMLTextAreaElement>();
  const router = useRouter();

  // Auto-resize textarea
  function autoResizeTextarea() {
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto';
        inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
      }
    });
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
    autoResizeTextarea();
  }

  async function handleSubmit() {
    if (!input.value.trim()) return;

    const message = input.value.trim();

    // Navigate to chat page with the input as a query parameter
    await router.push({
      path: '/chat',
      query: { message: message },
    });
  }

  // Watch input for auto-resize
  watch(input, autoResizeTextarea);

  // Focus input on mount
  onMounted(() => {
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus();
      }
    });
  });
</script>

<style scoped>
  /* Ensure the floating input is above other content */
  .z-50 {
    z-index: 50;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .fixed.bottom-6.right-6 {
      bottom: 1rem;
      right: 1rem;
      left: 1rem;
      max-width: none;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "placeholder": "Ask me anything about your Classic Mini...",
    "helper_text": "Chat with CMDIY Assistant"
  },
  "de": {
    "placeholder": "Fragen Sie mich alles über Ihren Classic Mini...",
    "helper_text": "Chatten Sie mit dem CMDIY Assistenten"
  },
  "es": {
    "placeholder": "Pregúntame cualquier cosa sobre tu Classic Mini...",
    "helper_text": "Chatea con el Asistente CMDIY"
  },
  "fr": {
    "placeholder": "Demandez-moi n'importe quoi sur votre Classic Mini...",
    "helper_text": "Chattez avec l'assistant CMDIY"
  },
  "it": {
    "placeholder": "Chiedimi qualsiasi cosa sulla tua Classic Mini...",
    "helper_text": "Chatta con l'assistente CMDIY"
  },
  "pt": {
    "placeholder": "Pergunte-me qualquer coisa sobre seu Classic Mini...",
    "helper_text": "Converse com o Assistente CMDIY"
  },
  "ru": {
    "placeholder": "Спросите меня что-нибудь о вашем Classic Mini...",
    "helper_text": "Чат с помощником CMDIY"
  },
  "ja": {
    "placeholder": "あなたのClassic Miniについて何でも聞いてください...",
    "helper_text": "CMDIYアシスタントとチャット"
  },
  "zh": {
    "placeholder": "询问任何关于您的Classic Mini的问题...",
    "helper_text": "与CMDIY助手聊天"
  },
  "ko": {
    "placeholder": "Classic Mini에 대해 무엇이든 물어보세요...",
    "helper_text": "CMDIY 어시스턴트와 채팅"
  }
}
</i18n>
