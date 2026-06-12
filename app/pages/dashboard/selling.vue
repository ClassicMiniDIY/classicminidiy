<script setup lang="ts">
  const { t } = useI18n();
  const supabase = useSupabase();
  const route = useRoute();
  const { user, userProfile } = useAuth();
  const { startSellerOnboarding } = useModelCheckout();

  type Seller = {
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    selling_disabled: boolean;
  } | null;

  interface SalesRow {
    model_id: string;
    model_title: string;
    sale_count: number;
    tip_count: number;
    gross_cents: number;
    fee_cents: number;
    net_cents: number;
  }

  const seller = ref<Seller>(null);
  const summary = ref<SalesRow[]>([]);
  const loading = ref(true);
  const onboarding = ref(false);
  const onboardError = ref<string | null>(null);

  const trustLevel = computed(() => userProfile.value?.trust_level ?? 'new');
  const trustOk = computed(() => ['contributor', 'trusted', 'moderator', 'admin'].includes(trustLevel.value));
  const canSell = computed(() => !!seller.value?.charges_enabled && !seller.value?.selling_disabled);
  const needsOnboarding = computed(() => !canSell.value && !seller.value?.selling_disabled);
  const justOnboarded = computed(() => route.query.onboarded === '1');

  async function load() {
    if (!import.meta.client || !user.value) {
      loading.value = false;
      return;
    }
    loading.value = true;
    const { data: s } = await supabase
      .from('seller_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, selling_disabled')
      .eq('user_id', user.value.id)
      .maybeSingle();
    seller.value = (s as Seller) ?? null;
    if (seller.value?.charges_enabled) {
      const { data: sum } = await supabase.rpc('get_model_sales_summary');
      summary.value = (sum as SalesRow[]) ?? [];
    }
    loading.value = false;
  }

  async function onboard() {
    onboardError.value = null;
    onboarding.value = true;
    const msg = await startSellerOnboarding();
    // On success the browser redirects to Stripe; we only land here on error.
    if (msg) {
      onboardError.value = msg;
      onboarding.value = false;
    }
  }

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  }

  const totals = computed(() =>
    summary.value.reduce(
      (a, r) => ({
        gross: a.gross + r.gross_cents,
        fee: a.fee + r.fee_cents,
        net: a.net + r.net_cents,
        sales: a.sales + r.sale_count,
        tips: a.tips + r.tip_count,
      }),
      { gross: 0, fee: 0, net: 0, sales: 0, tips: 0 }
    )
  );

  watch(user, load, { immediate: true });
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2">
      <i class="fad fa-store"></i>
      <h2 class="text-lg font-semibold">{{ t('heading') }}</h2>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else>
      <!-- Admin kill switch -->
      <div v-if="seller?.selling_disabled" role="alert" class="alert alert-error alert-soft">
        <i class="fas fa-ban"></i>
        <span>{{ t('disabledAlert') }}</span>
      </div>

      <!-- Webhook-lag confirmation right after returning from Stripe -->
      <div v-else-if="justOnboarded && !canSell" role="alert" class="alert alert-info alert-soft">
        <i class="fas fa-circle-info"></i>
        <span>{{ t('confirmingAlert') }}</span>
      </div>

      <!-- Onboarding pitch -->
      <div v-else-if="needsOnboarding" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-4">
          <h3 class="card-title">{{ t('onboarding.title') }}</h3>
          <p class="text-sm opacity-80">{{ t('onboarding.pitch') }}</p>
          <ul class="text-sm space-y-1">
            <li><i class="fas fa-check text-success mr-2"></i> {{ t('onboarding.bullet1') }}</li>
            <li><i class="fas fa-check text-success mr-2"></i> {{ t('onboarding.bullet2') }}</li>
            <li><i class="fas fa-check text-success mr-2"></i> {{ t('onboarding.bullet3') }}</li>
          </ul>

          <div v-if="!trustOk" role="alert" class="alert alert-warning alert-soft text-sm">
            <i class="fas fa-lock"></i>
            <span>{{ t('onboarding.trustWarning', { level: trustLevel }) }}</span>
          </div>

          <div v-if="onboardError" role="alert" class="alert alert-error alert-soft text-sm">
            <i class="fas fa-circle-exclamation"></i><span>{{ onboardError }}</span>
          </div>

          <div>
            <button class="btn btn-primary" :disabled="!trustOk || onboarding" @click="onboard">
              <span v-if="onboarding" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fab fa-stripe-s mr-1"></i>
              {{ seller ? t('onboarding.continueBtn') : t('onboarding.startBtn') }}
            </button>
          </div>
          <p class="text-xs opacity-50">{{ t('onboarding.redirectNote') }}</p>
        </div>
      </div>

      <!-- Sales console -->
      <template v-else>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body gap-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-circle-check text-success"></i>
                <span class="font-semibold">{{ t('console.readyLabel') }}</span>
                <span v-if="!seller?.payouts_enabled" class="badge badge-warning badge-sm">{{ t('console.payoutsPending') }}</span>
              </div>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-outline btn-sm"
              >
                <i class="fab fa-stripe-s mr-1"></i> {{ t('console.managePayouts') }}
              </a>
            </div>
            <p class="text-xs opacity-60">{{ t('console.refundNote') }}</p>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h3 class="font-semibold mb-2">{{ t('summary.title') }}</h3>
            <div v-if="summary.length === 0" class="text-center py-8 opacity-60">
              <i class="fas fa-chart-simple text-3xl mb-2 block"></i>
              <p>{{ t('summary.empty') }}</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>{{ t('summary.colModel') }}</th>
                    <th class="text-right">{{ t('summary.colSales') }}</th>
                    <th class="text-right">{{ t('summary.colTips') }}</th>
                    <th class="text-right">{{ t('summary.colGross') }}</th>
                    <th class="text-right">{{ t('summary.colFees') }}</th>
                    <th class="text-right">{{ t('summary.colNet') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in summary" :key="r.model_id">
                    <td class="font-medium">{{ r.model_title }}</td>
                    <td class="text-right">{{ r.sale_count }}</td>
                    <td class="text-right">{{ r.tip_count }}</td>
                    <td class="text-right">{{ fmt(r.gross_cents) }}</td>
                    <td class="text-right opacity-70">−{{ fmt(r.fee_cents) }}</td>
                    <td class="text-right font-semibold">{{ fmt(r.net_cents) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="font-semibold">
                    <td>{{ t('summary.total') }}</td>
                    <td class="text-right">{{ totals.sales }}</td>
                    <td class="text-right">{{ totals.tips }}</td>
                    <td class="text-right">{{ fmt(totals.gross) }}</td>
                    <td class="text-right">−{{ fmt(totals.fee) }}</td>
                    <td class="text-right">{{ fmt(totals.net) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Selling",
    "disabledAlert": "Selling is disabled for your account. Contact support if you believe this is a mistake.",
    "confirmingAlert": "Thanks! We're confirming your Stripe details — this can take a moment. Refresh this page shortly.",
    "onboarding": {
      "title": "Sell your 3D models",
      "pitch": "Charge a fixed price, let buyers pay what they want, or just accept tips. Payments run through your own Stripe account — you're the merchant of record and get paid directly. Classic Mini DIY keeps a 15% commission per sale.",
      "bullet1": "You keep 85% of every sale",
      "bullet2": "Buyers get every version, past and future",
      "bullet3": "Payouts, refunds, and taxes handled in Stripe",
      "trustWarning": "Selling unlocks at contributor trust. Share a model or contribute to the archive to get there — your current level is {level}.",
      "startBtn": "Start selling with Stripe",
      "continueBtn": "Continue Stripe onboarding",
      "redirectNote": "You'll be redirected to Stripe to set up payouts, then back here."
    },
    "console": {
      "readyLabel": "You're set up to sell",
      "payoutsPending": "Payouts pending",
      "managePayouts": "Manage payouts on Stripe",
      "refundNote": "Refunds and disputes are handled from your Stripe dashboard. The platform commission is not automatically refunded on a refund."
    },
    "summary": {
      "title": "Sales summary",
      "empty": "No sales yet. Price a model to get started.",
      "colModel": "Model",
      "colSales": "Sales",
      "colTips": "Tips",
      "colGross": "Gross",
      "colFees": "Fees",
      "colNet": "Net",
      "total": "Total"
    }
  },
  "es": {
    "heading": "Ventas",
    "disabledAlert": "Las ventas están desactivadas en tu cuenta. Contacta con soporte si crees que es un error.",
    "confirmingAlert": "¡Gracias! Estamos confirmando tus datos de Stripe, puede tardar un momento. Actualiza esta página en breve.",
    "onboarding": {
      "title": "Vende tus modelos 3D",
      "pitch": "Fija un precio, deja que los compradores paguen lo que quieran, o simplemente acepta propinas. Los pagos se procesan a través de tu propia cuenta de Stripe — eres el comerciante registrado y cobras directamente. Classic Mini DIY retiene una comisión del 15% por venta.",
      "bullet1": "Tú te quedas el 85% de cada venta",
      "bullet2": "Los compradores obtienen todas las versiones, pasadas y futuras",
      "bullet3": "Pagos, reembolsos e impuestos gestionados en Stripe",
      "trustWarning": "Las ventas se desbloquean con el nivel de confianza contribuidor. Comparte un modelo o contribuye al archivo para llegar ahí — tu nivel actual es {level}.",
      "startBtn": "Empieza a vender con Stripe",
      "continueBtn": "Continuar el registro en Stripe",
      "redirectNote": "Serás redirigido a Stripe para configurar los pagos y luego volverás aquí."
    },
    "console": {
      "readyLabel": "Estás listo para vender",
      "payoutsPending": "Pagos pendientes",
      "managePayouts": "Gestionar pagos en Stripe",
      "refundNote": "Los reembolsos y disputas se gestionan desde tu panel de Stripe. La comisión de la plataforma no se reembolsa automáticamente."
    },
    "summary": {
      "title": "Resumen de ventas",
      "empty": "Sin ventas todavía. Pon precio a un modelo para empezar.",
      "colModel": "Modelo",
      "colSales": "Ventas",
      "colTips": "Propinas",
      "colGross": "Bruto",
      "colFees": "Comisiones",
      "colNet": "Neto",
      "total": "Total"
    }
  },
  "fr": {
    "heading": "Ventes",
    "disabledAlert": "Les ventes sont désactivées sur votre compte. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
    "confirmingAlert": "Merci ! Nous confirmons vos informations Stripe — cela peut prendre un moment. Actualisez cette page dans peu de temps.",
    "onboarding": {
      "title": "Vendez vos modèles 3D",
      "pitch": "Fixez un prix, laissez les acheteurs payer ce qu'ils veulent, ou acceptez simplement des pourboires. Les paiements transitent par votre propre compte Stripe — vous êtes le marchand de référence et êtes payé directement. Classic Mini DIY prélève une commission de 15 % par vente.",
      "bullet1": "Vous gardez 85 % de chaque vente",
      "bullet2": "Les acheteurs reçoivent toutes les versions, passées et futures",
      "bullet3": "Paiements, remboursements et taxes gérés dans Stripe",
      "trustWarning": "Les ventes se débloquent au niveau de confiance contributeur. Partagez un modèle ou contribuez aux archives pour y parvenir — votre niveau actuel est {level}.",
      "startBtn": "Commencer à vendre avec Stripe",
      "continueBtn": "Continuer l'inscription Stripe",
      "redirectNote": "Vous serez redirigé vers Stripe pour configurer les paiements, puis ramené ici."
    },
    "console": {
      "readyLabel": "Vous êtes prêt à vendre",
      "payoutsPending": "Paiements en attente",
      "managePayouts": "Gérer les paiements sur Stripe",
      "refundNote": "Les remboursements et litiges sont gérés depuis votre tableau de bord Stripe. La commission de la plateforme n'est pas automatiquement remboursée en cas de remboursement."
    },
    "summary": {
      "title": "Résumé des ventes",
      "empty": "Aucune vente pour l'instant. Fixez un prix sur un modèle pour commencer.",
      "colModel": "Modèle",
      "colSales": "Ventes",
      "colTips": "Pourboires",
      "colGross": "Brut",
      "colFees": "Frais",
      "colNet": "Net",
      "total": "Total"
    }
  },
  "de": {
    "heading": "Verkaufen",
    "disabledAlert": "Das Verkaufen ist für dein Konto deaktiviert. Kontaktiere den Support, wenn du glaubst, dass dies ein Fehler ist.",
    "confirmingAlert": "Danke! Wir bestätigen deine Stripe-Daten — das kann einen Moment dauern. Lade diese Seite bald neu.",
    "onboarding": {
      "title": "Verkaufe deine 3D-Modelle",
      "pitch": "Lege einen Festpreis fest, lass Käufer zahlen, was sie möchten, oder akzeptiere einfach Trinkgelder. Zahlungen laufen über dein eigenes Stripe-Konto — du bist der Händler und wirst direkt bezahlt. Classic Mini DIY behält eine Provision von 15 % pro Verkauf.",
      "bullet1": "Du behältst 85 % jedes Verkaufs",
      "bullet2": "Käufer erhalten jede Version, vergangene und zukünftige",
      "bullet3": "Auszahlungen, Rückerstattungen und Steuern werden in Stripe verwaltet",
      "trustWarning": "Verkaufen wird mit dem Vertrauenslevel Beitragender freigeschaltet. Teile ein Modell oder trage zum Archiv bei, um es zu erreichen — dein aktuelles Level ist {level}.",
      "startBtn": "Mit Stripe verkaufen starten",
      "continueBtn": "Stripe-Onboarding fortsetzen",
      "redirectNote": "Du wirst zu Stripe weitergeleitet, um Auszahlungen einzurichten, und dann zurück hierher."
    },
    "console": {
      "readyLabel": "Du bist bereit zu verkaufen",
      "payoutsPending": "Auszahlungen ausstehend",
      "managePayouts": "Auszahlungen auf Stripe verwalten",
      "refundNote": "Rückerstattungen und Streitigkeiten werden über dein Stripe-Dashboard abgewickelt. Die Plattformprovision wird bei einer Rückerstattung nicht automatisch zurückerstattet."
    },
    "summary": {
      "title": "Verkaufsübersicht",
      "empty": "Noch keine Verkäufe. Setze einen Preis für ein Modell, um zu beginnen.",
      "colModel": "Modell",
      "colSales": "Verkäufe",
      "colTips": "Trinkgelder",
      "colGross": "Brutto",
      "colFees": "Gebühren",
      "colNet": "Netto",
      "total": "Gesamt"
    }
  },
  "it": {
    "heading": "Vendite",
    "disabledAlert": "Le vendite sono disabilitate per il tuo account. Contatta il supporto se ritieni si tratti di un errore.",
    "confirmingAlert": "Grazie! Stiamo confermando i tuoi dati Stripe — potrebbe richiedere un momento. Aggiorna questa pagina a breve.",
    "onboarding": {
      "title": "Vendi i tuoi modelli 3D",
      "pitch": "Fissa un prezzo fisso, lascia che gli acquirenti paghino quanto vogliono, o accetta semplicemente mance. I pagamenti transitano tramite il tuo account Stripe — sei il commerciante e vieni pagato direttamente. Classic Mini DIY trattiene una commissione del 15% per vendita.",
      "bullet1": "Tieni l'85% di ogni vendita",
      "bullet2": "Gli acquirenti ricevono ogni versione, passata e futura",
      "bullet3": "Pagamenti, rimborsi e tasse gestiti in Stripe",
      "trustWarning": "Le vendite si sbloccano al livello di fiducia collaboratore. Condividi un modello o contribuisci all'archivio per arrivarci — il tuo livello attuale è {level}.",
      "startBtn": "Inizia a vendere con Stripe",
      "continueBtn": "Continua l'iscrizione a Stripe",
      "redirectNote": "Verrai reindirizzato a Stripe per configurare i pagamenti, poi tornerai qui."
    },
    "console": {
      "readyLabel": "Sei pronto a vendere",
      "payoutsPending": "Pagamenti in attesa",
      "managePayouts": "Gestisci i pagamenti su Stripe",
      "refundNote": "I rimborsi e le controversie vengono gestiti dalla tua dashboard Stripe. La commissione della piattaforma non viene rimborsata automaticamente in caso di rimborso."
    },
    "summary": {
      "title": "Riepilogo vendite",
      "empty": "Nessuna vendita ancora. Metti un prezzo su un modello per iniziare.",
      "colModel": "Modello",
      "colSales": "Vendite",
      "colTips": "Mance",
      "colGross": "Lordo",
      "colFees": "Commissioni",
      "colNet": "Netto",
      "total": "Totale"
    }
  },
  "pt": {
    "heading": "Vendas",
    "disabledAlert": "As vendas estão desativadas na sua conta. Entre em contato com o suporte se acreditar que isso é um erro.",
    "confirmingAlert": "Obrigado! Estamos confirmando seus dados do Stripe — isso pode levar um momento. Atualize esta página em breve.",
    "onboarding": {
      "title": "Venda seus modelos 3D",
      "pitch": "Defina um preço fixo, deixe os compradores pagar o que quiserem, ou apenas aceite gorjetas. Os pagamentos são processados pela sua própria conta Stripe — você é o comerciante e recebe diretamente. Classic Mini DIY retém uma comissão de 15% por venda.",
      "bullet1": "Você fica com 85% de cada venda",
      "bullet2": "Compradores recebem todas as versões, passadas e futuras",
      "bullet3": "Pagamentos, reembolsos e impostos gerenciados no Stripe",
      "trustWarning": "As vendas se desbloqueiam no nível de confiança colaborador. Compartilhe um modelo ou contribua com o arquivo para chegar lá — seu nível atual é {level}.",
      "startBtn": "Comece a vender com o Stripe",
      "continueBtn": "Continuar integração com o Stripe",
      "redirectNote": "Você será redirecionado ao Stripe para configurar os pagamentos e, em seguida, voltará aqui."
    },
    "console": {
      "readyLabel": "Você está pronto para vender",
      "payoutsPending": "Pagamentos pendentes",
      "managePayouts": "Gerenciar pagamentos no Stripe",
      "refundNote": "Reembolsos e disputas são tratados no seu painel do Stripe. A comissão da plataforma não é reembolsada automaticamente em caso de reembolso."
    },
    "summary": {
      "title": "Resumo de vendas",
      "empty": "Ainda não há vendas. Defina um preço para um modelo para começar.",
      "colModel": "Modelo",
      "colSales": "Vendas",
      "colTips": "Gorjetas",
      "colGross": "Bruto",
      "colFees": "Taxas",
      "colNet": "Líquido",
      "total": "Total"
    }
  },
  "ru": {
    "heading": "Продажи",
    "disabledAlert": "Продажи отключены для вашего аккаунта. Обратитесь в поддержку, если считаете это ошибкой.",
    "confirmingAlert": "Спасибо! Мы подтверждаем ваши данные Stripe — это может занять момент. Обновите эту страницу через минуту.",
    "onboarding": {
      "title": "Продавайте свои 3D-модели",
      "pitch": "Установите фиксированную цену, позвольте покупателям платить столько, сколько они хотят, или просто принимайте чаевые. Платежи проходят через ваш собственный аккаунт Stripe — вы являетесь продавцом и получаете деньги напрямую. Classic Mini DIY берёт комиссию 15% с каждой продажи.",
      "bullet1": "Вы оставляете себе 85% с каждой продажи",
      "bullet2": "Покупатели получают все версии — прошлые и будущие",
      "bullet3": "Выплаты, возвраты и налоги управляются в Stripe",
      "trustWarning": "Продажи открываются на уровне доверия участник. Поделитесь моделью или внесите вклад в архив, чтобы достичь его — ваш текущий уровень: {level}.",
      "startBtn": "Начать продажи через Stripe",
      "continueBtn": "Продолжить регистрацию в Stripe",
      "redirectNote": "Вы будете перенаправлены на Stripe для настройки выплат, а затем вернётесь сюда."
    },
    "console": {
      "readyLabel": "Вы готовы к продажам",
      "payoutsPending": "Выплаты на рассмотрении",
      "managePayouts": "Управлять выплатами в Stripe",
      "refundNote": "Возвраты и споры обрабатываются через ваш дашборд Stripe. Комиссия платформы не возвращается автоматически при возврате средств."
    },
    "summary": {
      "title": "Сводка продаж",
      "empty": "Продаж пока нет. Установите цену на модель, чтобы начать.",
      "colModel": "Модель",
      "colSales": "Продажи",
      "colTips": "Чаевые",
      "colGross": "Выручка",
      "colFees": "Комиссии",
      "colNet": "Чистый доход",
      "total": "Итого"
    }
  },
  "ja": {
    "heading": "販売",
    "disabledAlert": "アカウントの販売が無効になっています。誤りだと思われる場合はサポートにお問い合わせください。",
    "confirmingAlert": "ありがとうございます！Stripeの詳細を確認しています — 少し時間がかかる場合があります。しばらくしてからページを更新してください。",
    "onboarding": {
      "title": "3Dモデルを販売する",
      "pitch": "固定価格を設定したり、購入者が好きな金額を払えるようにしたり、チップだけ受け付けたりできます。支払いはあなた自身のStripeアカウントを通じて処理され、あなたが販売者として直接支払いを受け取ります。Classic Mini DIYは販売ごとに15%の手数料を受け取ります。",
      "bullet1": "各販売の85%を受け取れます",
      "bullet2": "購入者は過去・未来のすべてのバージョンを入手できます",
      "bullet3": "支払い、返金、税金はStripeで管理",
      "trustWarning": "販売はコントリビューターの信頼レベルで解除されます。モデルをシェアするかアーカイブに貢献してください — 現在のレベルは{level}です。",
      "startBtn": "Stripeで販売を開始する",
      "continueBtn": "Stripeオンボーディングを続ける",
      "redirectNote": "支払いを設定するためStripeにリダイレクトされ、その後こちらに戻ります。"
    },
    "console": {
      "readyLabel": "販売の準備ができています",
      "payoutsPending": "支払い処理中",
      "managePayouts": "Stripeで支払いを管理",
      "refundNote": "返金や紛争はStripeダッシュボードから処理されます。返金時にプラットフォーム手数料は自動的に返金されません。"
    },
    "summary": {
      "title": "販売サマリー",
      "empty": "まだ販売がありません。モデルに価格を設定して始めましょう。",
      "colModel": "モデル",
      "colSales": "販売数",
      "colTips": "チップ",
      "colGross": "総売上",
      "colFees": "手数料",
      "colNet": "純利益",
      "total": "合計"
    }
  },
  "zh": {
    "heading": "销售",
    "disabledAlert": "您的账户销售功能已被禁用。如果您认为这是错误，请联系支持团队。",
    "confirmingAlert": "感谢！我们正在确认您的Stripe详情——这可能需要片刻。请稍后刷新此页面。",
    "onboarding": {
      "title": "销售您的3D模型",
      "pitch": "设置固定价格、让买家随意付款，或仅接受小费。付款通过您自己的Stripe账户处理——您是商户，直接收款。Classic Mini DIY每笔销售收取15%佣金。",
      "bullet1": "每笔销售您保留85%",
      "bullet2": "买家获得所有版本，包括过去和未来的",
      "bullet3": "付款、退款和税务均在Stripe中处理",
      "trustWarning": "在贡献者信任等级时解锁销售功能。分享模型或为存档做贡献即可达到——您当前的等级是{level}。",
      "startBtn": "通过Stripe开始销售",
      "continueBtn": "继续Stripe入驻",
      "redirectNote": "您将被重定向到Stripe设置付款，然后返回此处。"
    },
    "console": {
      "readyLabel": "您已准备好销售",
      "payoutsPending": "付款待处理",
      "managePayouts": "在Stripe上管理付款",
      "refundNote": "退款和争议从您的Stripe仪表板处理。退款时平台佣金不会自动退还。"
    },
    "summary": {
      "title": "销售摘要",
      "empty": "还没有销售。为模型定价即可开始。",
      "colModel": "模型",
      "colSales": "销售",
      "colTips": "小费",
      "colGross": "总收入",
      "colFees": "费用",
      "colNet": "净收入",
      "total": "总计"
    }
  },
  "ko": {
    "heading": "판매",
    "disabledAlert": "계정의 판매 기능이 비활성화되어 있습니다. 오류라고 생각되면 지원팀에 문의하세요.",
    "confirmingAlert": "감사합니다! Stripe 세부 정보를 확인 중입니다 — 잠시 시간이 걸릴 수 있습니다. 잠시 후 페이지를 새로 고쳐 주세요.",
    "onboarding": {
      "title": "3D 모델을 판매하세요",
      "pitch": "고정 가격을 설정하거나, 구매자가 원하는 금액을 내도록 하거나, 팁만 받을 수도 있습니다. 결제는 본인의 Stripe 계정을 통해 처리되며 — 귀하가 판매자로서 직접 지급받습니다. Classic Mini DIY는 판매당 15% 수수료를 가져갑니다.",
      "bullet1": "각 판매의 85%를 가져갑니다",
      "bullet2": "구매자는 과거와 미래의 모든 버전을 받습니다",
      "bullet3": "지급, 환불, 세금은 Stripe에서 처리됩니다",
      "trustWarning": "판매는 기여자 신뢰 수준에서 잠금 해제됩니다. 모델을 공유하거나 아카이브에 기여하여 도달하세요 — 현재 레벨은 {level}입니다.",
      "startBtn": "Stripe로 판매 시작하기",
      "continueBtn": "Stripe 온보딩 계속하기",
      "redirectNote": "지급을 설정하기 위해 Stripe로 이동하며, 그 후 여기로 돌아옵니다."
    },
    "console": {
      "readyLabel": "판매 준비가 되었습니다",
      "payoutsPending": "지급 대기 중",
      "managePayouts": "Stripe에서 지급 관리",
      "refundNote": "환불 및 분쟁은 Stripe 대시보드에서 처리됩니다. 환불 시 플랫폼 수수료는 자동으로 환불되지 않습니다."
    },
    "summary": {
      "title": "판매 요약",
      "empty": "아직 판매가 없습니다. 모델에 가격을 설정하여 시작하세요.",
      "colModel": "모델",
      "colSales": "판매",
      "colTips": "팁",
      "colGross": "총수입",
      "colFees": "수수료",
      "colNet": "순수입",
      "total": "합계"
    }
  }
}
</i18n>
