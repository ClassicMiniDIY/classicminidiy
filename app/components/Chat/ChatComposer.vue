<template>
  <div>
    <form
      @submit.prevent="emit('submit')"
      class="rounded-2xl border border-base-300 bg-base-200 shadow-sm transition-colors focus-within:border-primary/50"
    >
      <label :for="textareaId" class="sr-only">{{ t('input_placeholder') }}</label>
      <textarea
        :id="textareaId"
        ref="inputRef"
        :value="modelValue"
        @input="onInput"
        @keydown="onKeyDown"
        :placeholder="t('input_placeholder')"
        class="w-full resize-none bg-transparent px-4 pt-3 leading-6 outline-none placeholder:text-base-content/50"
        :style="{ maxHeight: `${MAX_HEIGHT}px` }"
        rows="1"
      ></textarea>

      <!-- Control row, inside the composer -->
      <div class="flex items-center gap-1 px-2 pb-2">
        <button
          type="button"
          @click="emit('new-chat')"
          class="btn btn-ghost btn-sm gap-2 font-normal"
          :disabled="disableNewChat"
          :title="t('new_chat')"
        >
          <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ t('new_chat') }}</span>
          <span class="sr-only sm:hidden">{{ t('new_chat') }}</span>
        </button>

        <NuxtLink to="/contact" class="btn btn-ghost btn-sm gap-2 font-normal" :title="t('report_issue')">
          <i class="fas fa-flag" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ t('report_issue') }}</span>
          <span class="sr-only sm:hidden">{{ t('report_issue') }}</span>
        </NuxtLink>

        <!-- The hint is hidden below `md`, so it cannot be the only thing
             carrying `ml-auto` — the send button would sit next to the icon
             buttons on a phone. Each button carries the spacer at small sizes
             and hands it back to the hint from `md` up. -->
        <span class="hidden pr-2 text-xs text-base-content/50 md:ml-auto md:inline">{{ t('hint') }}</span>

        <button
          v-if="isLoading"
          type="button"
          @click="emit('stop')"
          class="ml-auto md:ml-0 btn btn-sm btn-square btn-neutral"
          :aria-label="t('stop_generating')"
          :title="t('stop_generating')"
        >
          <i class="fas fa-stop" aria-hidden="true"></i>
        </button>
        <button
          v-else
          type="submit"
          class="ml-auto md:ml-0 btn btn-sm btn-square btn-primary"
          :disabled="!modelValue.trim()"
          :aria-label="t('send_message')"
          :title="t('send_message')"
        >
          <i class="fas fa-arrow-up" aria-hidden="true"></i>
        </button>
      </div>
    </form>

    <!-- The disclaimer lives here, as one muted line, the way every mainstream
         assistant states it. It used to be a full alert block that took roughly a
         fifth of a phone screen. -->
    <p class="mt-2 text-center text-xs text-base-content/50">
      {{ t('disclaimer') }}
    </p>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      isLoading?: boolean;
      disableNewChat?: boolean;
    }>(),
    { isLoading: false, disableNewChat: false }
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string];
    submit: [];
    stop: [];
    'new-chat': [];
  }>();

  const MAX_HEIGHT = 200;

  const textareaId = useId();
  const inputRef = ref<HTMLTextAreaElement>();

  function resize() {
    const el = inputRef.value;
    if (!el) return;

    // Never measure a box with no layout. A backgrounded tab, a `display:none`
    // ancestor or a pane mid-resize gives the field ~0 width, which wraps the
    // placeholder onto dozens of lines and reports a scrollHeight far past
    // MAX_HEIGHT — locking an empty composer open at full height. Skipping
    // leaves the last good height in place until real layout returns.
    if (el.clientWidth === 0) return;

    // Measure with the scrollbar suppressed and the height unconstrained, so
    // scrollHeight reports the true content height. The previous version read
    // scrollHeight again *after* writing the clamped height, by which point it
    // reports the clamped box rather than the content — so once the field hit
    // MAX_HEIGHT it reported MAX_HEIGHT forever and could never shrink back.
    el.style.height = 'auto';
    el.style.overflowY = 'hidden';

    const contentHeight = el.scrollHeight;
    el.style.height = `${Math.min(contentHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = contentHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }

  function onInput(e: Event) {
    emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
    // Resize from the event as well as from the prop watcher below. Typing is
    // the common path and must not wait on a round trip through the parent.
    resize();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (!props.isLoading && props.modelValue.trim()) emit('submit');
    }
  }

  // Resize after the parent writes a new value.
  //
  // `flush: 'post'` so the textarea has already been patched with the new value
  // when this runs — measuring before the patch sizes the field to the OLD text.
  watch(() => props.modelValue, resize, { flush: 'post' });

  function focus() {
    // `preventScroll` because focusing a control near the bottom of the shell
    // used to scroll the document on load, landing the user below the nav.
    inputRef.value?.focus({ preventScroll: true });
  }

  // `resize` is exposed because the watcher above cannot be relied on for the
  // send path. Sending sets the value to the prompt and then straight back to
  // '' — if both land in one flush, Vue sees no net change and skips the
  // callback entirely, leaving the field stuck at whatever height it last
  // measured. The parent calls resize() explicitly after clearing.
  defineExpose({ focus, resize });
</script>

<i18n lang="json">
{
  "en": {
    "input_placeholder": "Ask me anything about your Classic Mini...",
    "new_chat": "New chat",
    "report_issue": "Report an issue",
    "hint": "Enter to send, Shift+Enter for a new line",
    "send_message": "Send message",
    "stop_generating": "Stop generating",
    "disclaimer": "The assistant is experimental and can be wrong. Verify anything critical against official documentation or a qualified mechanic."
  },
  "es": {
    "input_placeholder": "Pregúntame cualquier cosa sobre tu Classic Mini...",
    "new_chat": "Nuevo chat",
    "report_issue": "Reportar un problema",
    "hint": "Enter para enviar, Mayús+Enter para nueva línea",
    "send_message": "Enviar mensaje",
    "stop_generating": "Detener generación",
    "disclaimer": "El asistente es experimental y puede equivocarse. Verifica todo lo crítico con documentación oficial o un mecánico cualificado."
  },
  "fr": {
    "input_placeholder": "Demandez-moi n'importe quoi sur votre Classic Mini...",
    "new_chat": "Nouveau chat",
    "report_issue": "Signaler un problème",
    "hint": "Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne",
    "send_message": "Envoyer le message",
    "stop_generating": "Arrêter la génération",
    "disclaimer": "L'assistant est expérimental et peut se tromper. Vérifiez tout élément critique avec la documentation officielle ou un mécanicien qualifié."
  },
  "de": {
    "input_placeholder": "Fragen Sie mich alles über Ihren Classic Mini...",
    "new_chat": "Neuer Chat",
    "report_issue": "Problem melden",
    "hint": "Enter zum Senden, Umschalt+Enter für neue Zeile",
    "send_message": "Nachricht senden",
    "stop_generating": "Generierung stoppen",
    "disclaimer": "Der Assistent ist experimentell und kann sich irren. Prüfen Sie alles Kritische anhand offizieller Dokumentation oder mit einem qualifizierten Mechaniker."
  },
  "it": {
    "input_placeholder": "Chiedimi qualsiasi cosa sulla tua Classic Mini...",
    "new_chat": "Nuova chat",
    "report_issue": "Segnala un problema",
    "hint": "Invio per inviare, Maiusc+Invio per andare a capo",
    "send_message": "Invia messaggio",
    "stop_generating": "Interrompi generazione",
    "disclaimer": "L'assistente è sperimentale e può sbagliare. Verifica ogni informazione critica con la documentazione ufficiale o un meccanico qualificato."
  },
  "pt": {
    "input_placeholder": "Pergunte-me qualquer coisa sobre seu Classic Mini...",
    "new_chat": "Novo chat",
    "report_issue": "Relatar um problema",
    "hint": "Enter para enviar, Shift+Enter para nova linha",
    "send_message": "Enviar mensagem",
    "stop_generating": "Parar geração",
    "disclaimer": "O assistente é experimental e pode errar. Verifique qualquer informação crítica com documentação oficial ou um mecânico qualificado."
  },
  "ru": {
    "input_placeholder": "Спросите меня что-нибудь о вашем Classic Mini...",
    "new_chat": "Новый чат",
    "report_issue": "Сообщить о проблеме",
    "hint": "Enter — отправить, Shift+Enter — новая строка",
    "send_message": "Отправить сообщение",
    "stop_generating": "Остановить генерацию",
    "disclaimer": "Помощник экспериментальный и может ошибаться. Проверяйте важную информацию по официальной документации или у квалифицированного механика."
  },
  "ja": {
    "input_placeholder": "あなたのClassic Miniについて何でもお聞きください...",
    "new_chat": "新しいチャット",
    "report_issue": "問題を報告",
    "hint": "Enterで送信、Shift+Enterで改行",
    "send_message": "メッセージを送信",
    "stop_generating": "生成を停止",
    "disclaimer": "このアシスタントは実験的なもので、誤ることがあります。重要な情報は公式資料か有資格の整備士で確認してください。"
  },
  "zh": {
    "input_placeholder": "询问我关于您的Classic Mini的任何问题...",
    "new_chat": "新对话",
    "report_issue": "报告问题",
    "hint": "Enter 发送，Shift+Enter 换行",
    "send_message": "发送消息",
    "stop_generating": "停止生成",
    "disclaimer": "此助手为实验性功能，可能出错。重要信息请以官方文档或合格技师为准。"
  },
  "ko": {
    "input_placeholder": "Classic Mini에 대해 무엇이든 물어보세요...",
    "new_chat": "새 대화",
    "report_issue": "문제 신고",
    "hint": "Enter로 전송, Shift+Enter로 줄바꿈",
    "send_message": "메시지 보내기",
    "stop_generating": "생성 중단",
    "disclaimer": "이 어시스턴트는 실험적이며 틀릴 수 있습니다. 중요한 내용은 공식 문서나 자격을 갖춘 정비사에게 확인하세요."
  }
}
</i18n>
