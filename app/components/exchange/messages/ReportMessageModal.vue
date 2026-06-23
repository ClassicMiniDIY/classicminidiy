<template>
  <dialog ref="modalEl" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ t('title') }}</h3>
      <p class="text-base-content/70 mt-2">{{ t('prompt') }}</p>

      <div class="mt-4">
        <textarea
          v-model="reason"
          class="textarea textarea-bordered w-full"
          rows="3"
          :placeholder="t('placeholder')"
          maxlength="500"
        ></textarea>
        <div class="text-xs text-base-content/50 mt-1 text-right">{{ t('charCount', { count: reason.length }) }}</div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="close">{{ t('cancel') }}</button>
        <button class="btn btn-error" :disabled="!reason.trim() || submitting" @click="submit">
          <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
          {{ t('submit') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>{{ t('close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    messageId: string;
    conversationId: string;
  }>();

  const emit = defineEmits<{
    reported: [];
  }>();

  const { reportMessage } = useMessages();

  const modalEl = ref<HTMLDialogElement | null>(null);
  const reason = ref('');
  const submitting = ref(false);

  const open = () => {
    reason.value = '';
    modalEl.value?.showModal();
  };

  const close = () => {
    modalEl.value?.close();
    reason.value = '';
  };

  const submit = async () => {
    if (!reason.value.trim()) return;

    submitting.value = true;
    try {
      const success = await reportMessage(props.messageId, props.conversationId, reason.value.trim());
      if (success) {
        close();
        emit('reported');
      }
    } finally {
      submitting.value = false;
    }
  };

  defineExpose({ open, close });
</script>

<i18n lang="json">
{
  "en": { "title": "Report Message", "prompt": "Why are you reporting this message?", "placeholder": "Describe the issue (harassment, spam, scam, etc.)...", "charCount": "{count}/500", "cancel": "Cancel", "submit": "Report Message", "close": "close" },
  "es": { "title": "Reportar mensaje", "prompt": "¿Por qué reportas este mensaje?", "placeholder": "Describe el problema (acoso, spam, estafa, etc.)...", "charCount": "{count}/500", "cancel": "Cancelar", "submit": "Reportar mensaje", "close": "cerrar" },
  "fr": { "title": "Signaler le message", "prompt": "Pourquoi signalez-vous ce message ?", "placeholder": "Décrivez le problème (harcèlement, spam, arnaque, etc.)...", "charCount": "{count}/500", "cancel": "Annuler", "submit": "Signaler le message", "close": "fermer" },
  "de": { "title": "Nachricht melden", "prompt": "Warum meldest du diese Nachricht?", "placeholder": "Beschreibe das Problem (Belästigung, Spam, Betrug usw.)...", "charCount": "{count}/500", "cancel": "Abbrechen", "submit": "Nachricht melden", "close": "schließen" },
  "it": { "title": "Segnala messaggio", "prompt": "Perché segnali questo messaggio?", "placeholder": "Descrivi il problema (molestie, spam, truffa, ecc.)...", "charCount": "{count}/500", "cancel": "Annulla", "submit": "Segnala messaggio", "close": "chiudi" },
  "pt": { "title": "Denunciar mensagem", "prompt": "Por que você está denunciando esta mensagem?", "placeholder": "Descreva o problema (assédio, spam, golpe, etc.)...", "charCount": "{count}/500", "cancel": "Cancelar", "submit": "Denunciar mensagem", "close": "fechar" },
  "ru": { "title": "Пожаловаться на сообщение", "prompt": "Почему вы жалуетесь на это сообщение?", "placeholder": "Опишите проблему (домогательство, спам, мошенничество и т. д.)...", "charCount": "{count}/500", "cancel": "Отмена", "submit": "Пожаловаться", "close": "закрыть" },
  "ja": { "title": "メッセージを報告", "prompt": "このメッセージを報告する理由は何ですか？", "placeholder": "問題を説明してください（嫌がらせ、スパム、詐欺など）...", "charCount": "{count}/500", "cancel": "キャンセル", "submit": "メッセージを報告", "close": "閉じる" },
  "zh": { "title": "举报消息", "prompt": "您为什么要举报这条消息？", "placeholder": "描述问题（骚扰、垃圾信息、诈骗等）...", "charCount": "{count}/500", "cancel": "取消", "submit": "举报消息", "close": "关闭" },
  "ko": { "title": "메시지 신고", "prompt": "이 메시지를 신고하는 이유는 무엇인가요?", "placeholder": "문제를 설명해 주세요 (괴롭힘, 스팸, 사기 등)...", "charCount": "{count}/500", "cancel": "취소", "submit": "메시지 신고", "close": "닫기" }
}
</i18n>
