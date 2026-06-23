<template>
  <div>
    <!-- Tier Selection -->
    <div class="grid grid-cols-1 gap-6 mb-8" :class="{ 'md:grid-cols-2': !isSustainingMember }">
      <!-- Free Tier — hidden for members (Premium is included with membership) -->
      <button
        v-if="!isSustainingMember"
        type="button"
        class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2 text-left"
        :class="modelValue === 'free' ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'"
        @click="selectTier('free')"
      >
        <div class="card-body">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-bold">{{ t('free.name') }}</h3>
              <p class="text-3xl font-bold text-primary mt-1">{{ t('free.price') }}</p>
            </div>
            <div v-if="modelValue === 'free'" class="badge badge-primary">{{ t('selected') }}</div>
          </div>

          <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{
                category === 'vehicle'
                  ? t('feature.photosPerSection', { count: freePhotoLimit })
                  : t('feature.photosTotal', { count: freePhotoLimit })
              }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.fullDetails') }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.buyerMessaging') }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.qaComments') }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.activeUntilSold') }}</span>
            </li>
            <li class="flex items-center gap-2 text-base-content/50">
              <i class="fas fa-circle-xmark"></i>
              <span>{{ t('feature.standardSearch') }}</span>
            </li>
            <li class="flex items-center gap-2 text-base-content/50">
              <i class="fas fa-clock"></i>
              <span>{{ t('feature.adminReview') }}</span>
            </li>
          </ul>
        </div>
      </button>

      <!-- Premium Tier -->
      <button
        type="button"
        class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2 text-left relative overflow-hidden"
        :class="modelValue === 'paid' ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'"
        @click="selectTier('paid')"
      >
        <div class="absolute top-0 right-0 bg-primary text-primary-content px-3 py-1 text-xs font-bold">
          {{ t('recommended') }}
        </div>
        <div class="card-body">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-bold">{{ t('premium.name') }}</h3>
              <template v-if="isSustainingMember">
                <p class="text-3xl font-bold text-primary mt-1">{{ t('premium.included') }}</p>
                <div class="mt-1">
                  <ExchangeProfileSustainingBadge size="sm" />
                </div>
              </template>
              <template v-else>
                <p class="text-3xl font-bold text-primary mt-1">{{ t('premium.price') }}</p>
                <p class="text-xs text-base-content/70">{{ t('premium.oneTime') }}</p>
              </template>
            </div>
            <div v-if="modelValue === 'paid'" class="badge badge-primary">{{ t('selected') }}</div>
          </div>

          <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{
                category === 'vehicle'
                  ? t('feature.photosPerSection', { count: paidPhotoLimit })
                  : t('feature.photosTotal', { count: paidPhotoLimit })
              }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.fullDetails') }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.buyerMessaging') }}</span>
            </li>
            <li class="flex items-center gap-2">
              <i class="fas fa-circle-check text-primary"></i>
              <span>{{ t('feature.qaComments') }}</span>
            </li>
            <li class="flex items-center gap-2 font-medium text-primary">
              <i class="fas fa-arrow-trend-up"></i>
              <span>{{ t('feature.prioritySearch') }}</span>
            </li>
            <li class="flex items-center gap-2 font-medium text-primary">
              <i class="fas fa-house"></i>
              <span>{{ t('feature.homepageCarousel') }}</span>
            </li>
            <li class="flex items-center gap-2 font-medium text-primary">
              <i class="fas fa-bolt"></i>
              <span>{{ t('feature.instantActivation') }}</span>
            </li>
            <li class="flex items-center gap-2 font-medium">
              <span class="flex gap-1 flex-shrink-0">
                <i class="fab fa-facebook text-[#1877F2]"></i>
                <i class="fab fa-instagram text-[#E4405F]"></i>
                <i class="fab fa-bluesky text-[#0085FF]"></i>
              </span>
              <span>{{ t('feature.socialAutoPost') }}</span>
            </li>
          </ul>
        </div>
      </button>
    </div>

    <!-- Non-member upsell: premium is free for Sustaining Members -->
    <div v-if="!isSustainingMember" class="text-center text-sm text-base-content/70 mb-6">
      <i class="far fa-star inline-block text-warning align-text-bottom"></i>
      {{ t('upsell.text') }}
      <NuxtLink to="/membership" class="link link-primary font-medium">{{ t('upsell.learnMore') }}</NuxtLink>
    </div>

    <!-- Payment Note -->
    <div v-if="isSustainingMember" class="alert mb-8 border border-primary/20 bg-primary/10">
      <i class="far fa-star text-primary text-xl"></i>
      <div>
        <p class="font-medium text-primary">{{ t('memberNote.title') }}</p>
        <p class="text-sm text-base-content/80">{{ t('memberNote.body') }}</p>
      </div>
    </div>
    <div v-else class="alert alert-info mb-8">
      <i class="fas fa-circle-info text-xl"></i>
      <div>
        <p class="font-medium">{{ t('paymentNote.title') }}</p>
        <p class="text-sm">{{ t('paymentNote.body') }}</p>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-between">
      <button type="button" class="btn btn-ghost" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
        {{ t('nav.back') }}
      </button>
      <div class="flex gap-2">
        <button type="button" class="btn btn-outline" @click="$emit('save-draft')" :disabled="savingDraft">
          <span v-if="savingDraft" class="loading loading-spinner loading-sm"></span>
          <i v-else class="fas fa-bookmark"></i>
          {{ t('nav.saveDraft') }}
        </button>
        <button type="button" class="btn btn-primary" @click="$emit('next')">
          {{ t('nav.continue') }}
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    modelValue: 'free' | 'paid';
    category: 'vehicle' | 'engine' | 'parts' | '';
    isSustainingMember?: boolean;
    savingDraft?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: 'free' | 'paid'];
    next: [];
    back: [];
    'save-draft': [];
  }>();

  const { capture } = usePostHog();

  // Track tier selection changes
  const selectTier = (tier: 'free' | 'paid') => {
    const previousTier = props.modelValue;
    emit('update:modelValue', tier);

    // Only track if actually changed
    if (tier !== previousTier) {
      capture('tier_selected', {
        tier,
        previous_tier: previousTier,
      });
    }
  };

  const freePhotoLimit = computed(() => {
    return props.category === 'vehicle' ? 5 : 10;
  });

  const paidPhotoLimit = computed(() => {
    return props.category === 'vehicle' ? 20 : 15;
  });

  // Sustaining Members only get Premium (the Free card is hidden), so auto-select
  // it — including when membership loads async after the step is already shown.
  watch(
    () => props.isSustainingMember,
    (isMember) => {
      if (isMember && props.modelValue !== 'paid') {
        emit('update:modelValue', 'paid');
      }
    },
    { immediate: true }
  );
</script>

<i18n lang="json">
{
  "en": {
    "selected": "Selected",
    "recommended": "RECOMMENDED",
    "free": { "name": "Free Listing", "price": "$0" },
    "premium": { "name": "Premium Listing", "included": "Included", "price": "$10", "oneTime": "one-time payment" },
    "feature": {
      "photosPerSection": "Up to {count} photos per section",
      "photosTotal": "Up to {count} photos total",
      "fullDetails": "Full listing details",
      "buyerMessaging": "Buyer messaging",
      "qaComments": "Q&A comments",
      "activeUntilSold": "Active until sold or cancelled",
      "standardSearch": "Standard search placement",
      "adminReview": "Admin review required (24-48 hrs)",
      "prioritySearch": "Priority in search results",
      "homepageCarousel": "Homepage carousel exposure",
      "instantActivation": "Instant activation after payment",
      "socialAutoPost": "Auto-posted to our Facebook, Instagram & Bluesky"
    },
    "upsell": { "text": "Premium listings are included for Sustaining Members.", "learnMore": "Learn more" },
    "memberNote": { "title": "Your Sustaining membership covers Premium — no payment needed", "body": "Premium is included with your membership. Just submit your listing." },
    "paymentNote": { "title": "Payment is collected after you submit your listing", "body": "Complete your listing first, then pay securely via Stripe if you chose Premium." },
    "nav": { "back": "Back", "saveDraft": "Save Draft", "continue": "Continue" }
  },
  "es": {
    "selected": "Seleccionado",
    "recommended": "RECOMENDADO",
    "free": { "name": "Anuncio gratis", "price": "0 $" },
    "premium": { "name": "Anuncio premium", "included": "Incluido", "price": "10 $", "oneTime": "pago único" },
    "feature": {
      "photosPerSection": "Hasta {count} fotos por sección",
      "photosTotal": "Hasta {count} fotos en total",
      "fullDetails": "Detalles completos del anuncio",
      "buyerMessaging": "Mensajería con compradores",
      "qaComments": "Comentarios de preguntas y respuestas",
      "activeUntilSold": "Activo hasta vender o cancelar",
      "standardSearch": "Posición estándar en búsquedas",
      "adminReview": "Requiere revisión del administrador (24-48 h)",
      "prioritySearch": "Prioridad en los resultados de búsqueda",
      "homepageCarousel": "Aparición en el carrusel de la portada",
      "instantActivation": "Activación instantánea tras el pago",
      "socialAutoPost": "Publicado automáticamente en nuestro Facebook, Instagram y Bluesky"
    },
    "upsell": { "text": "Los anuncios premium están incluidos para los miembros de apoyo.", "learnMore": "Más información" },
    "memberNote": { "title": "Tu membresía de apoyo cubre Premium: no se necesita pago", "body": "Premium está incluido con tu membresía. Solo envía tu anuncio." },
    "paymentNote": { "title": "El pago se cobra después de enviar tu anuncio", "body": "Completa primero tu anuncio y luego paga de forma segura con Stripe si elegiste Premium." },
    "nav": { "back": "Atrás", "saveDraft": "Guardar borrador", "continue": "Continuar" }
  },
  "fr": {
    "selected": "Sélectionné",
    "recommended": "RECOMMANDÉ",
    "free": { "name": "Annonce gratuite", "price": "0 $" },
    "premium": { "name": "Annonce premium", "included": "Inclus", "price": "10 $", "oneTime": "paiement unique" },
    "feature": {
      "photosPerSection": "Jusqu'à {count} photos par section",
      "photosTotal": "Jusqu'à {count} photos au total",
      "fullDetails": "Détails complets de l'annonce",
      "buyerMessaging": "Messagerie avec les acheteurs",
      "qaComments": "Commentaires questions-réponses",
      "activeUntilSold": "Active jusqu'à la vente ou l'annulation",
      "standardSearch": "Placement standard dans la recherche",
      "adminReview": "Révision par un administrateur requise (24-48 h)",
      "prioritySearch": "Priorité dans les résultats de recherche",
      "homepageCarousel": "Exposition dans le carrousel d'accueil",
      "instantActivation": "Activation instantanée après paiement",
      "socialAutoPost": "Publié automatiquement sur nos Facebook, Instagram et Bluesky"
    },
    "upsell": { "text": "Les annonces premium sont incluses pour les membres de soutien.", "learnMore": "En savoir plus" },
    "memberNote": { "title": "Votre adhésion de soutien couvre Premium — aucun paiement nécessaire", "body": "Premium est inclus avec votre adhésion. Soumettez simplement votre annonce." },
    "paymentNote": { "title": "Le paiement est collecté après la soumission de votre annonce", "body": "Complétez d'abord votre annonce, puis payez en toute sécurité via Stripe si vous avez choisi Premium." },
    "nav": { "back": "Retour", "saveDraft": "Enregistrer le brouillon", "continue": "Continuer" }
  },
  "de": {
    "selected": "Ausgewählt",
    "recommended": "EMPFOHLEN",
    "free": { "name": "Kostenlose Anzeige", "price": "0 $" },
    "premium": { "name": "Premium-Anzeige", "included": "Inklusive", "price": "10 $", "oneTime": "Einmalzahlung" },
    "feature": {
      "photosPerSection": "Bis zu {count} Fotos pro Abschnitt",
      "photosTotal": "Bis zu {count} Fotos insgesamt",
      "fullDetails": "Vollständige Anzeigendetails",
      "buyerMessaging": "Käufer-Nachrichten",
      "qaComments": "Fragen-und-Antworten-Kommentare",
      "activeUntilSold": "Aktiv bis verkauft oder storniert",
      "standardSearch": "Standardplatzierung in der Suche",
      "adminReview": "Admin-Prüfung erforderlich (24-48 Std.)",
      "prioritySearch": "Priorität in den Suchergebnissen",
      "homepageCarousel": "Sichtbarkeit im Startseiten-Karussell",
      "instantActivation": "Sofortige Aktivierung nach Zahlung",
      "socialAutoPost": "Automatisch auf unseren Kanälen Facebook, Instagram & Bluesky gepostet"
    },
    "upsell": { "text": "Premium-Anzeigen sind für Fördermitglieder inklusive.", "learnMore": "Mehr erfahren" },
    "memberNote": { "title": "Deine Fördermitgliedschaft deckt Premium ab — keine Zahlung nötig", "body": "Premium ist in deiner Mitgliedschaft enthalten. Reiche einfach deine Anzeige ein." },
    "paymentNote": { "title": "Die Zahlung wird nach dem Einreichen deiner Anzeige eingezogen", "body": "Vervollständige zuerst deine Anzeige und zahle dann sicher per Stripe, wenn du Premium gewählt hast." },
    "nav": { "back": "Zurück", "saveDraft": "Entwurf speichern", "continue": "Weiter" }
  },
  "it": {
    "selected": "Selezionato",
    "recommended": "CONSIGLIATO",
    "free": { "name": "Annuncio gratuito", "price": "0 $" },
    "premium": { "name": "Annuncio premium", "included": "Incluso", "price": "10 $", "oneTime": "pagamento una tantum" },
    "feature": {
      "photosPerSection": "Fino a {count} foto per sezione",
      "photosTotal": "Fino a {count} foto in totale",
      "fullDetails": "Dettagli completi dell'annuncio",
      "buyerMessaging": "Messaggi con gli acquirenti",
      "qaComments": "Commenti di domande e risposte",
      "activeUntilSold": "Attivo fino alla vendita o all'annullamento",
      "standardSearch": "Posizionamento standard nella ricerca",
      "adminReview": "Revisione dell'amministratore richiesta (24-48 h)",
      "prioritySearch": "Priorità nei risultati di ricerca",
      "homepageCarousel": "Visibilità nel carosello della homepage",
      "instantActivation": "Attivazione immediata dopo il pagamento",
      "socialAutoPost": "Pubblicato automaticamente sui nostri Facebook, Instagram e Bluesky"
    },
    "upsell": { "text": "Gli annunci premium sono inclusi per i membri sostenitori.", "learnMore": "Scopri di più" },
    "memberNote": { "title": "La tua iscrizione sostenitore copre Premium — nessun pagamento necessario", "body": "Premium è incluso nella tua iscrizione. Invia semplicemente il tuo annuncio." },
    "paymentNote": { "title": "Il pagamento viene riscosso dopo l'invio dell'annuncio", "body": "Completa prima il tuo annuncio, poi paga in sicurezza tramite Stripe se hai scelto Premium." },
    "nav": { "back": "Indietro", "saveDraft": "Salva bozza", "continue": "Continua" }
  },
  "pt": {
    "selected": "Selecionado",
    "recommended": "RECOMENDADO",
    "free": { "name": "Anúncio gratuito", "price": "$0" },
    "premium": { "name": "Anúncio premium", "included": "Incluído", "price": "$10", "oneTime": "pagamento único" },
    "feature": {
      "photosPerSection": "Até {count} fotos por seção",
      "photosTotal": "Até {count} fotos no total",
      "fullDetails": "Detalhes completos do anúncio",
      "buyerMessaging": "Mensagens com compradores",
      "qaComments": "Comentários de perguntas e respostas",
      "activeUntilSold": "Ativo até ser vendido ou cancelado",
      "standardSearch": "Posicionamento padrão na busca",
      "adminReview": "Revisão do administrador necessária (24-48 h)",
      "prioritySearch": "Prioridade nos resultados de busca",
      "homepageCarousel": "Exposição no carrossel da página inicial",
      "instantActivation": "Ativação instantânea após o pagamento",
      "socialAutoPost": "Publicado automaticamente em nossos Facebook, Instagram e Bluesky"
    },
    "upsell": { "text": "Os anúncios premium estão incluídos para membros de apoio.", "learnMore": "Saiba mais" },
    "memberNote": { "title": "Sua assinatura de apoio cobre o Premium — nenhum pagamento necessário", "body": "O Premium está incluído na sua assinatura. Basta enviar seu anúncio." },
    "paymentNote": { "title": "O pagamento é cobrado depois que você envia seu anúncio", "body": "Conclua primeiro seu anúncio e depois pague com segurança via Stripe se escolheu o Premium." },
    "nav": { "back": "Voltar", "saveDraft": "Salvar rascunho", "continue": "Continuar" }
  },
  "ru": {
    "selected": "Выбрано",
    "recommended": "РЕКОМЕНДУЕТСЯ",
    "free": { "name": "Бесплатное объявление", "price": "$0" },
    "premium": { "name": "Премиум-объявление", "included": "Включено", "price": "$10", "oneTime": "разовый платёж" },
    "feature": {
      "photosPerSection": "До {count} фото в каждом разделе",
      "photosTotal": "До {count} фото всего",
      "fullDetails": "Полные сведения об объявлении",
      "buyerMessaging": "Переписка с покупателями",
      "qaComments": "Комментарии с вопросами и ответами",
      "activeUntilSold": "Активно до продажи или отмены",
      "standardSearch": "Стандартное размещение в поиске",
      "adminReview": "Требуется проверка администратором (24-48 ч)",
      "prioritySearch": "Приоритет в результатах поиска",
      "homepageCarousel": "Показ в карусели на главной странице",
      "instantActivation": "Мгновенная активация после оплаты",
      "socialAutoPost": "Автоматически публикуется в наших Facebook, Instagram и Bluesky"
    },
    "upsell": { "text": "Премиум-объявления включены для постоянных участников.", "learnMore": "Подробнее" },
    "memberNote": { "title": "Ваше постоянное участие покрывает Премиум — оплата не нужна", "body": "Премиум включён в ваше участие. Просто отправьте объявление." },
    "paymentNote": { "title": "Оплата взимается после отправки объявления", "body": "Сначала заполните объявление, затем безопасно оплатите через Stripe, если выбрали Премиум." },
    "nav": { "back": "Назад", "saveDraft": "Сохранить черновик", "continue": "Продолжить" }
  },
  "ja": {
    "selected": "選択済み",
    "recommended": "おすすめ",
    "free": { "name": "無料出品", "price": "$0" },
    "premium": { "name": "プレミアム出品", "included": "含まれています", "price": "$10", "oneTime": "一回限りの支払い" },
    "feature": {
      "photosPerSection": "セクションごとに最大 {count} 枚の写真",
      "photosTotal": "合計で最大 {count} 枚の写真",
      "fullDetails": "出品の詳細をすべて掲載",
      "buyerMessaging": "購入者とのメッセージ",
      "qaComments": "Q&Aコメント",
      "activeUntilSold": "売却またはキャンセルまで有効",
      "standardSearch": "標準的な検索表示",
      "adminReview": "管理者の審査が必要（24〜48時間）",
      "prioritySearch": "検索結果で優先表示",
      "homepageCarousel": "トップページのカルーセルに掲載",
      "instantActivation": "支払い後すぐに有効化",
      "socialAutoPost": "当社の Facebook、Instagram、Bluesky に自動投稿"
    },
    "upsell": { "text": "プレミアム出品はサステイニングメンバーに含まれています。", "learnMore": "詳しく見る" },
    "memberNote": { "title": "サステイニング会員ならプレミアムは対象 — 支払いは不要です", "body": "プレミアムは会員資格に含まれています。出品を送信するだけです。" },
    "paymentNote": { "title": "支払いは出品を送信した後に行われます", "body": "まず出品を完成させ、プレミアムを選んだ場合は Stripe で安全に支払ってください。" },
    "nav": { "back": "戻る", "saveDraft": "下書きを保存", "continue": "続ける" }
  },
  "zh": {
    "selected": "已选择",
    "recommended": "推荐",
    "free": { "name": "免费刊登", "price": "$0" },
    "premium": { "name": "高级刊登", "included": "已包含", "price": "$10", "oneTime": "一次性付款" },
    "feature": {
      "photosPerSection": "每个版块最多 {count} 张照片",
      "photosTotal": "总共最多 {count} 张照片",
      "fullDetails": "完整的刊登详情",
      "buyerMessaging": "买家消息",
      "qaComments": "问答评论",
      "activeUntilSold": "在售出或取消前一直有效",
      "standardSearch": "标准搜索排位",
      "adminReview": "需要管理员审核（24-48 小时）",
      "prioritySearch": "搜索结果中优先展示",
      "homepageCarousel": "首页轮播展示",
      "instantActivation": "付款后即时激活",
      "socialAutoPost": "自动发布到我们的 Facebook、Instagram 和 Bluesky"
    },
    "upsell": { "text": "高级刊登已包含在持续会员权益中。", "learnMore": "了解更多" },
    "memberNote": { "title": "您的持续会员资格已涵盖高级刊登 — 无需付款", "body": "高级刊登已包含在您的会员资格中。直接提交您的刊登即可。" },
    "paymentNote": { "title": "付款在您提交刊登后收取", "body": "请先完成您的刊登，若选择了高级刊登，再通过 Stripe 安全付款。" },
    "nav": { "back": "返回", "saveDraft": "保存草稿", "continue": "继续" }
  },
  "ko": {
    "selected": "선택됨",
    "recommended": "추천",
    "free": { "name": "무료 매물", "price": "$0" },
    "premium": { "name": "프리미엄 매물", "included": "포함됨", "price": "$10", "oneTime": "일회성 결제" },
    "feature": {
      "photosPerSection": "섹션당 최대 {count}장의 사진",
      "photosTotal": "총 최대 {count}장의 사진",
      "fullDetails": "전체 매물 상세 정보",
      "buyerMessaging": "구매자 메시지",
      "qaComments": "질문과 답변 댓글",
      "activeUntilSold": "판매되거나 취소될 때까지 활성",
      "standardSearch": "일반 검색 노출",
      "adminReview": "관리자 검토 필요 (24-48시간)",
      "prioritySearch": "검색 결과에서 우선 노출",
      "homepageCarousel": "홈페이지 캐러셀 노출",
      "instantActivation": "결제 후 즉시 활성화",
      "socialAutoPost": "당사 Facebook, Instagram, Bluesky에 자동 게시"
    },
    "upsell": { "text": "프리미엄 매물은 후원 회원에게 포함되어 있습니다.", "learnMore": "자세히 보기" },
    "memberNote": { "title": "후원 멤버십에 프리미엄이 포함됩니다 — 결제가 필요 없습니다", "body": "프리미엄은 멤버십에 포함되어 있습니다. 매물만 제출하세요." },
    "paymentNote": { "title": "결제는 매물을 제출한 후에 청구됩니다", "body": "먼저 매물을 완성한 다음, 프리미엄을 선택했다면 Stripe로 안전하게 결제하세요." },
    "nav": { "back": "뒤로", "saveDraft": "임시 저장", "continue": "계속" }
  }
}
</i18n>
