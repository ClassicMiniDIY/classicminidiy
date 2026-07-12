<template>
  <dialog ref="modalEl" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ t('title') }}</h3>
      <p class="text-base-content/70 mt-2">{{ t('prompt') }}</p>

      <!-- Quick-reason presets — speeds up reporting the common scam patterns -->
      <div class="flex flex-wrap gap-2 mt-4">
        <button
          v-for="preset in reasonPresets"
          :key="preset.key"
          type="button"
          class="btn btn-xs"
          :class="reason === preset.label ? 'btn-error' : 'btn-outline'"
          :aria-pressed="reason === preset.label"
          @click="reason = preset.label"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="mt-3">
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

  // Localized quick-reason chips. The submitted reason is the localized label —
  // admins review free text anyway, and presets mostly save the reporter typing.
  const reasonPresets = computed(() =>
    (['scam', 'offPlatform', 'spam', 'harassment', 'payment'] as const).map((key) => ({
      key,
      label: t(`presets.${key}`),
    }))
  );

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
  "en": {"title": "Report Message", "prompt": "Why are you reporting this message?", "placeholder": "Describe the issue (harassment, spam, scam, etc.)...", "charCount": "{count}/500", "cancel": "Cancel", "submit": "Report Message", "close": "close", "presets": {"scam": "Scam or phishing", "offPlatform": "Asking to move off-platform", "spam": "Spam", "harassment": "Harassment", "payment": "Suspicious payment request"}},
  "es": {"title": "Reportar mensaje", "prompt": "¿Por qué reportas este mensaje?", "placeholder": "Describe el problema (acoso, spam, estafa, etc.)...", "charCount": "{count}/500", "cancel": "Cancelar", "submit": "Reportar mensaje", "close": "cerrar", "presets": {"scam": "Estafa o phishing", "offPlatform": "Pide salir de la plataforma", "spam": "Spam", "harassment": "Acoso", "payment": "Solicitud de pago sospechosa"}},
  "fr": {"title": "Signaler le message", "prompt": "Pourquoi signalez-vous ce message ?", "placeholder": "Décrivez le problème (harcèlement, spam, arnaque, etc.)...", "charCount": "{count}/500", "cancel": "Annuler", "submit": "Signaler le message", "close": "fermer", "presets": {"scam": "Arnaque ou hameçonnage", "offPlatform": "Demande de quitter la plateforme", "spam": "Spam", "harassment": "Harcèlement", "payment": "Demande de paiement suspecte"}},
  "de": {"title": "Nachricht melden", "prompt": "Warum meldest du diese Nachricht?", "placeholder": "Beschreibe das Problem (Belästigung, Spam, Betrug usw.)...", "charCount": "{count}/500", "cancel": "Abbrechen", "submit": "Nachricht melden", "close": "schließen", "presets": {"scam": "Betrug oder Phishing", "offPlatform": "Will die Plattform verlassen", "spam": "Spam", "harassment": "Belästigung", "payment": "Verdächtige Zahlungsaufforderung"}},
  "it": {"title": "Segnala messaggio", "prompt": "Perché segnali questo messaggio?", "placeholder": "Descrivi il problema (molestie, spam, truffa, ecc.)...", "charCount": "{count}/500", "cancel": "Annulla", "submit": "Segnala messaggio", "close": "chiudi", "presets": {"scam": "Truffa o phishing", "offPlatform": "Chiede di uscire dalla piattaforma", "spam": "Spam", "harassment": "Molestie", "payment": "Richiesta di pagamento sospetta"}},
  "pt": {"title": "Denunciar mensagem", "prompt": "Por que você está denunciando esta mensagem?", "placeholder": "Descreva o problema (assédio, spam, golpe, etc.)...", "charCount": "{count}/500", "cancel": "Cancelar", "submit": "Denunciar mensagem", "close": "fechar", "presets": {"scam": "Golpe ou phishing", "offPlatform": "Pede para sair da plataforma", "spam": "Spam", "harassment": "Assédio", "payment": "Pedido de pagamento suspeito"}},
  "ru": {"title": "Пожаловаться на сообщение", "prompt": "Почему вы жалуетесь на это сообщение?", "placeholder": "Опишите проблему (домогательство, спам, мошенничество и т. д.)...", "charCount": "{count}/500", "cancel": "Отмена", "submit": "Пожаловаться", "close": "закрыть", "presets": {"scam": "Мошенничество или фишинг", "offPlatform": "Просит уйти с платформы", "spam": "Спам", "harassment": "Домогательство", "payment": "Подозрительный запрос оплаты"}},
  "ja": {"title": "メッセージを報告", "prompt": "このメッセージを報告する理由は何ですか？", "placeholder": "問題を説明してください（嫌がらせ、スパム、詐欺など）...", "charCount": "{count}/500", "cancel": "キャンセル", "submit": "メッセージを報告", "close": "閉じる", "presets": {"scam": "詐欺・フィッシング", "offPlatform": "プラットフォーム外への誘導", "spam": "スパム", "harassment": "嫌がらせ", "payment": "不審な支払い要求"}},
  "zh": {"title": "举报消息", "prompt": "您为什么要举报这条消息？", "placeholder": "描述问题（骚扰、垃圾信息、诈骗等）...", "charCount": "{count}/500", "cancel": "取消", "submit": "举报消息", "close": "关闭", "presets": {"scam": "诈骗或钓鱼", "offPlatform": "要求转到平台外交易", "spam": "垃圾信息", "harassment": "骚扰", "payment": "可疑的付款请求"}},
  "ko": {"title": "메시지 신고", "prompt": "이 메시지를 신고하는 이유는 무엇인가요?", "placeholder": "문제를 설명해 주세요 (괴롭힘, 스팸, 사기 등)...", "charCount": "{count}/500", "cancel": "취소", "submit": "메시지 신고", "close": "닫기", "presets": {"scam": "사기 또는 피싱", "offPlatform": "플랫폼 밖 거래 요구", "spam": "스팸", "harassment": "괴롭힘", "payment": "의심스러운 결제 요청"}}
}
</i18n>
