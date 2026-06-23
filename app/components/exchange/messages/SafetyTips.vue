<template>
  <div v-if="visible" class="alert items-start bg-info/10 border border-info/20 text-sm relative pr-10">
    <button
      class="btn btn-ghost btn-xs btn-circle absolute top-2 right-2"
      @click="dismiss"
      :aria-label="t('dismiss')"
    >
      <i class="fas fa-xmark"></i>
    </button>
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas fa-shield-halved text-info shrink-0"></i>
        <span class="font-semibold text-info">{{ t('title') }}</span>
      </div>
      <ul class="space-y-1 text-base-content/70">
        <li class="flex items-start gap-2">
          <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
          <span>{{ t('tip1') }}</span>
        </li>
        <li class="flex items-start gap-2">
          <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
          <span>{{ t('tip2') }}</span>
        </li>
        <li class="flex items-start gap-2">
          <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
          <span>{{ t('tip3') }}</span>
        </li>
        <li class="flex items-start gap-2">
          <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
          <span>{{ t('tip4Prefix') }}<NuxtLink to="/safety" class="link link-info">{{ t('tip4Link') }}</NuxtLink>.</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    conversationId: string;
  }>();

  // Track dismissed conversations in localStorage
  const STORAGE_KEY = 'tme-safety-tips-dismissed';

  const visible = ref(false);

  onMounted(() => {
    try {
      const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      visible.value = !dismissed.includes(props.conversationId);
    } catch {
      visible.value = true;
    }
  });

  const dismiss = () => {
    visible.value = false;
    try {
      const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!dismissed.includes(props.conversationId)) {
        dismissed.push(props.conversationId);
        // Keep only last 100 entries to avoid bloating localStorage
        if (dismissed.length > 100) dismissed.splice(0, dismissed.length - 100);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
      }
    } catch {
      // Ignore localStorage errors
    }
  };
</script>

<i18n lang="json">
{
  "en": { "dismiss": "Dismiss safety tips", "title": "Safety Reminder", "tip1": "Meet in a public place for in-person exchanges.", "tip2": "Use traceable payment methods (bank transfer, PayPal Goods & Services).", "tip3": "Never share personal financial details in messages.", "tip4Prefix": "If something feels off, ", "tip4Link": "read our full safety guide" },
  "es": { "dismiss": "Descartar consejos de seguridad", "title": "Recordatorio de seguridad", "tip1": "Reúnete en un lugar público para los intercambios en persona.", "tip2": "Usa métodos de pago rastreables (transferencia bancaria, PayPal Bienes y Servicios).", "tip3": "Nunca compartas datos financieros personales en los mensajes.", "tip4Prefix": "Si algo te parece sospechoso, ", "tip4Link": "lee nuestra guía de seguridad completa" },
  "fr": { "dismiss": "Ignorer les conseils de sécurité", "title": "Rappel de sécurité", "tip1": "Rencontrez-vous dans un lieu public pour les échanges en personne.", "tip2": "Utilisez des modes de paiement traçables (virement bancaire, PayPal Biens & Services).", "tip3": "Ne partagez jamais de coordonnées financières personnelles dans les messages.", "tip4Prefix": "Si quelque chose vous semble anormal, ", "tip4Link": "consultez notre guide de sécurité complet" },
  "de": { "dismiss": "Sicherheitstipps ausblenden", "title": "Sicherheitshinweis", "tip1": "Treffen Sie sich für persönliche Übergaben an einem öffentlichen Ort.", "tip2": "Verwenden Sie nachvollziehbare Zahlungsmethoden (Banküberweisung, PayPal Waren & Dienstleistungen).", "tip3": "Teilen Sie niemals persönliche Finanzdaten in Nachrichten.", "tip4Prefix": "Wenn Ihnen etwas seltsam vorkommt, ", "tip4Link": "lesen Sie unseren vollständigen Sicherheitsleitfaden" },
  "it": { "dismiss": "Ignora i consigli di sicurezza", "title": "Promemoria di sicurezza", "tip1": "Incontratevi in un luogo pubblico per gli scambi di persona.", "tip2": "Usa metodi di pagamento tracciabili (bonifico bancario, PayPal Beni e Servizi).", "tip3": "Non condividere mai dati finanziari personali nei messaggi.", "tip4Prefix": "Se qualcosa non ti convince, ", "tip4Link": "leggi la nostra guida completa alla sicurezza" },
  "pt": { "dismiss": "Dispensar dicas de segurança", "title": "Lembrete de segurança", "tip1": "Encontre-se em um local público para trocas presenciais.", "tip2": "Use métodos de pagamento rastreáveis (transferência bancária, PayPal Bens e Serviços).", "tip3": "Nunca compartilhe dados financeiros pessoais nas mensagens.", "tip4Prefix": "Se algo parecer estranho, ", "tip4Link": "leia nosso guia completo de segurança" },
  "ru": { "dismiss": "Скрыть советы по безопасности", "title": "Напоминание о безопасности", "tip1": "Для личных встреч выбирайте общественные места.", "tip2": "Используйте отслеживаемые способы оплаты (банковский перевод, PayPal «Товары и услуги»).", "tip3": "Никогда не сообщайте личные финансовые данные в сообщениях.", "tip4Prefix": "Если что-то кажется подозрительным, ", "tip4Link": "прочитайте наше полное руководство по безопасности" },
  "ja": { "dismiss": "安全に関するヒントを閉じる", "title": "安全に関する注意", "tip1": "対面での取引は公共の場所で行いましょう。", "tip2": "追跡可能な支払い方法を利用しましょう（銀行振込、PayPalの商品・サービス）。", "tip3": "メッセージで個人の金融情報を共有しないでください。", "tip4Prefix": "何か不審に感じたら、", "tip4Link": "安全ガイド全文をご覧ください" },
  "zh": { "dismiss": "关闭安全提示", "title": "安全提醒", "tip1": "当面交易请在公共场所进行。", "tip2": "使用可追溯的付款方式（银行转账、PayPal 商品与服务）。", "tip3": "切勿在消息中分享个人财务信息。", "tip4Prefix": "如果感觉有任何不对劲，", "tip4Link": "请阅读我们的完整安全指南" },
  "ko": { "dismiss": "안전 팁 닫기", "title": "안전 알림", "tip1": "직접 거래는 공공장소에서 만나세요.", "tip2": "추적 가능한 결제 수단을 사용하세요(계좌 이체, PayPal 상품 및 서비스).", "tip3": "메시지로 개인 금융 정보를 절대 공유하지 마세요.", "tip4Prefix": "무언가 이상하다고 느껴지면 ", "tip4Link": "전체 안전 가이드를 읽어보세요" }
}
</i18n>
