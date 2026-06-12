<script setup lang="ts">
  /**
   * Report a model (keystone §11 PR 8 / §8 takedown intake). Authenticated insert
   * into model_reports under RLS (own reporter_id, resolution fields NULL).
   */
  const props = defineProps<{ modelId: string }>();

  const { t } = useI18n();
  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const open = ref(false);
  const reason = ref('copyright');
  const details = ref('');
  const submitting = ref(false);
  const done = ref(false);
  const error = ref('');

  const reasons = computed(() => [
    { value: 'copyright', label: t('reasons.copyright') },
    { value: 'safety', label: t('reasons.safety') },
    { value: 'inappropriate', label: t('reasons.inappropriate') },
    { value: 'spam', label: t('reasons.spam') },
    { value: 'other', label: t('reasons.other') },
  ]);

  function openModal() {
    if (!isAuthenticated.value) return navigateTo('/login');
    done.value = false;
    error.value = '';
    details.value = '';
    reason.value = 'copyright';
    open.value = true;
  }

  async function submit() {
    if (!details.value.trim()) {
      error.value = t('errorDescribe');
      return;
    }
    if (!user.value) return;
    submitting.value = true;
    error.value = '';
    try {
      const { error: e } = await supabase.from('model_reports').insert({
        model_id: props.modelId,
        reason: reason.value,
        details: details.value.trim().slice(0, 5000),
        reporter_id: user.value.id,
      });
      if (e) throw e;
      done.value = true;
    } catch (e: any) {
      error.value = e?.message || t('errorSubmit');
    } finally {
      submitting.value = false;
    }
  }
</script>

<template>
  <button type="button" class="btn btn-ghost btn-xs gap-1 opacity-70" @click="openModal">
    <i class="fas fa-flag"></i> {{ t('reportButton') }}
  </button>

  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box">
      <h3 class="font-bold text-lg"><i class="fas fa-flag text-warning mr-1"></i> {{ t('title') }}</h3>

      <div v-if="done" class="py-6 text-center">
        <i class="fas fa-circle-check text-4xl text-success"></i>
        <p class="mt-2">{{ t('successMessage') }}</p>
        <button class="btn btn-primary btn-sm mt-4" @click="open = false">{{ t('close') }}</button>
      </div>

      <div v-else class="py-2 space-y-2">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('reasonLabel') }}</legend>
          <select v-model="reason" class="select w-full">
            <option v-for="r in reasons" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('detailsLabel') }}</legend>
          <textarea
            v-model="details"
            rows="4"
            maxlength="5000"
            class="textarea w-full"
            :placeholder="t('detailsPlaceholder')"
          ></textarea>
        </fieldset>
        <p v-if="error" class="text-error text-sm">{{ error }}</p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="open = false">{{ t('cancel') }}</button>
          <button type="button" class="btn btn-warning" :disabled="submitting" @click="submit">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ t('submit') }}
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="open = false"><button>close</button></form>
  </dialog>
</template>

<i18n lang="json">
{
  "en": {
    "reportButton": "Report",
    "title": "Report this model",
    "reasonLabel": "Reason",
    "detailsLabel": "Details",
    "detailsPlaceholder": "What's the issue? Include links/evidence for copyright claims.",
    "successMessage": "Thanks — our moderators will review this.",
    "close": "Close",
    "cancel": "Cancel",
    "submit": "Submit report",
    "errorDescribe": "Please describe the issue.",
    "errorSubmit": "Could not submit the report.",
    "reasons": {
      "copyright": "Copyright / IP infringement",
      "safety": "Safety concern",
      "inappropriate": "Inappropriate content",
      "spam": "Spam",
      "other": "Other"
    }
  },
  "es": {
    "reportButton": "Reportar",
    "title": "Reportar este modelo",
    "reasonLabel": "Motivo",
    "detailsLabel": "Detalles",
    "detailsPlaceholder": "¿Cuál es el problema? Incluye enlaces/evidencia para reclamaciones de copyright.",
    "successMessage": "Gracias — nuestros moderadores lo revisarán.",
    "close": "Cerrar",
    "cancel": "Cancelar",
    "submit": "Enviar reporte",
    "errorDescribe": "Por favor, describe el problema.",
    "errorSubmit": "No se pudo enviar el reporte.",
    "reasons": {
      "copyright": "Infracción de derechos de autor / PI",
      "safety": "Preocupación de seguridad",
      "inappropriate": "Contenido inapropiado",
      "spam": "Spam",
      "other": "Otro"
    }
  },
  "fr": {
    "reportButton": "Signaler",
    "title": "Signaler ce modèle",
    "reasonLabel": "Motif",
    "detailsLabel": "Détails",
    "detailsPlaceholder": "Quel est le problème ? Incluez des liens/preuves pour les réclamations de droit d'auteur.",
    "successMessage": "Merci — nos modérateurs vont examiner cela.",
    "close": "Fermer",
    "cancel": "Annuler",
    "submit": "Envoyer le signalement",
    "errorDescribe": "Veuillez décrire le problème.",
    "errorSubmit": "Impossible d'envoyer le signalement.",
    "reasons": {
      "copyright": "Violation de droit d'auteur / PI",
      "safety": "Problème de sécurité",
      "inappropriate": "Contenu inapproprié",
      "spam": "Spam",
      "other": "Autre"
    }
  },
  "de": {
    "reportButton": "Melden",
    "title": "Dieses Modell melden",
    "reasonLabel": "Grund",
    "detailsLabel": "Details",
    "detailsPlaceholder": "Was ist das Problem? Füge Links/Nachweise für Urheberrechtsansprüche hinzu.",
    "successMessage": "Danke — unsere Moderatoren werden dies prüfen.",
    "close": "Schließen",
    "cancel": "Abbrechen",
    "submit": "Meldung absenden",
    "errorDescribe": "Bitte beschreibe das Problem.",
    "errorSubmit": "Die Meldung konnte nicht gesendet werden.",
    "reasons": {
      "copyright": "Urheberrechts- / IP-Verletzung",
      "safety": "Sicherheitsbedenken",
      "inappropriate": "Unangemessener Inhalt",
      "spam": "Spam",
      "other": "Sonstiges"
    }
  },
  "it": {
    "reportButton": "Segnala",
    "title": "Segnala questo modello",
    "reasonLabel": "Motivo",
    "detailsLabel": "Dettagli",
    "detailsPlaceholder": "Qual è il problema? Includi link/prove per le rivendicazioni di copyright.",
    "successMessage": "Grazie — i nostri moderatori lo esamineranno.",
    "close": "Chiudi",
    "cancel": "Annulla",
    "submit": "Invia segnalazione",
    "errorDescribe": "Descrivi il problema.",
    "errorSubmit": "Impossibile inviare la segnalazione.",
    "reasons": {
      "copyright": "Violazione di copyright / PI",
      "safety": "Problema di sicurezza",
      "inappropriate": "Contenuto inappropriato",
      "spam": "Spam",
      "other": "Altro"
    }
  },
  "pt": {
    "reportButton": "Reportar",
    "title": "Reportar este modelo",
    "reasonLabel": "Motivo",
    "detailsLabel": "Detalhes",
    "detailsPlaceholder": "Qual é o problema? Inclua links/evidências para reclamações de direitos autorais.",
    "successMessage": "Obrigado — nossos moderadores vão analisar isso.",
    "close": "Fechar",
    "cancel": "Cancelar",
    "submit": "Enviar relatório",
    "errorDescribe": "Por favor, descreva o problema.",
    "errorSubmit": "Não foi possível enviar o relatório.",
    "reasons": {
      "copyright": "Violação de direitos autorais / PI",
      "safety": "Preocupação de segurança",
      "inappropriate": "Conteúdo inadequado",
      "spam": "Spam",
      "other": "Outro"
    }
  },
  "ru": {
    "reportButton": "Пожаловаться",
    "title": "Пожаловаться на модель",
    "reasonLabel": "Причина",
    "detailsLabel": "Подробности",
    "detailsPlaceholder": "В чём проблема? Добавьте ссылки/доказательства для претензий по авторскому праву.",
    "successMessage": "Спасибо — наши модераторы рассмотрят это.",
    "close": "Закрыть",
    "cancel": "Отмена",
    "submit": "Отправить жалобу",
    "errorDescribe": "Пожалуйста, опишите проблему.",
    "errorSubmit": "Не удалось отправить жалобу.",
    "reasons": {
      "copyright": "Нарушение авторских прав / ИС",
      "safety": "Проблема безопасности",
      "inappropriate": "Неприемлемый контент",
      "spam": "Спам",
      "other": "Другое"
    }
  },
  "ja": {
    "reportButton": "報告",
    "title": "このモデルを報告",
    "reasonLabel": "理由",
    "detailsLabel": "詳細",
    "detailsPlaceholder": "問題の内容は？著作権の申し立てにはリンク・証拠を含めてください。",
    "successMessage": "ありがとうございます — モデレーターが確認します。",
    "close": "閉じる",
    "cancel": "キャンセル",
    "submit": "報告を送信",
    "errorDescribe": "問題を説明してください。",
    "errorSubmit": "報告を送信できませんでした。",
    "reasons": {
      "copyright": "著作権・知的財産の侵害",
      "safety": "安全上の懸念",
      "inappropriate": "不適切なコンテンツ",
      "spam": "スパム",
      "other": "その他"
    }
  },
  "zh": {
    "reportButton": "举报",
    "title": "举报此模型",
    "reasonLabel": "原因",
    "detailsLabel": "详细信息",
    "detailsPlaceholder": "问题是什么？请附上版权投诉的链接/证据。",
    "successMessage": "感谢您的举报 — 我们的管理员将进行审核。",
    "close": "关闭",
    "cancel": "取消",
    "submit": "提交举报",
    "errorDescribe": "请描述问题。",
    "errorSubmit": "无法提交举报。",
    "reasons": {
      "copyright": "版权 / 知识产权侵权",
      "safety": "安全问题",
      "inappropriate": "不当内容",
      "spam": "垃圾内容",
      "other": "其他"
    }
  },
  "ko": {
    "reportButton": "신고",
    "title": "이 모델 신고",
    "reasonLabel": "이유",
    "detailsLabel": "세부 정보",
    "detailsPlaceholder": "문제가 무엇인가요? 저작권 주장의 경우 링크/증거를 포함하세요.",
    "successMessage": "감사합니다 — 관리자가 검토할 예정입니다.",
    "close": "닫기",
    "cancel": "취소",
    "submit": "신고 제출",
    "errorDescribe": "문제를 설명해 주세요.",
    "errorSubmit": "신고를 제출할 수 없습니다.",
    "reasons": {
      "copyright": "저작권 / 지적재산권 침해",
      "safety": "안전 우려",
      "inappropriate": "부적절한 콘텐츠",
      "spam": "스팸",
      "other": "기타"
    }
  }
}
</i18n>
