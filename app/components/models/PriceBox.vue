<script setup lang="ts">
  import type { ModelDetail } from '~~/data/models/model-library';

  const props = defineProps<{
    model: Pick<ModelDetail, 'id' | 'pricingMode' | 'priceCents' | 'suggestedPriceCents' | 'minPriceCents' | 'currency'>;
  }>();

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { startCheckout } = useModelCheckout();

  const minCents = computed(() => props.model.minPriceCents ?? 100);
  // PWYW dollar amount, seeded from the suggested price (or the floor).
  const amount = ref<number>((props.model.suggestedPriceCents ?? props.model.minPriceCents ?? 100) / 100);

  const loading = ref(false);
  const error = ref<string | null>(null);
  // Buyer must acknowledge that digital sales are final before purchasing — sets
  // expectations and provides consent evidence for chargeback defense / the
  // EU/UK immediate-delivery withdrawal waiver.
  const acked = ref(false);

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (props.model.currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }

  async function buy() {
    error.value = null;
    if (!isAuthenticated.value) {
      await navigateTo('/login');
      return;
    }
    let cents: number | undefined;
    if (props.model.pricingMode === 'pwyw') {
      cents = Math.round((Number(amount.value) || 0) * 100);
      if (!Number.isFinite(cents) || cents < minCents.value) {
        error.value = t('error.minimum', { price: fmt(minCents.value) });
        return;
      }
    }
    loading.value = true;
    // On success startCheckout redirects to Stripe; we only continue on failure.
    const msg = await startCheckout(props.model.id, 'purchase', cents);
    if (msg) {
      error.value = msg;
      loading.value = false;
    }
  }
</script>

<template>
  <div class="space-y-2">
    <fieldset v-if="model.pricingMode === 'pwyw'" class="fieldset">
      <legend class="fieldset-legend">{{ t('pwyw.legend') }}</legend>
      <label class="input w-full">
        <span class="opacity-60">$</span>
        <input v-model.number="amount" type="number" :min="minCents / 100" step="1" class="grow" />
      </label>
      <p class="label">{{ t('pwyw.hint', { price: fmt(minCents) }) }}</p>
    </fieldset>

    <label class="flex items-start gap-2 cursor-pointer text-xs opacity-80">
      <input v-model="acked" type="checkbox" class="checkbox checkbox-xs checkbox-primary mt-0.5" />
      <span>{{ t('finalSale') }}</span>
    </label>

    <button class="btn btn-primary w-full" :disabled="loading || !acked" @click="buy">
      <span v-if="loading" class="loading loading-spinner loading-sm"></span>
      <i v-else class="fas fa-cart-shopping mr-1"></i>
      <template v-if="model.pricingMode === 'fixed'">{{ t('buy.fixed', { price: fmt(model.priceCents ?? 0) }) }}</template>
      <template v-else>{{ t('buy.now') }}</template>
    </button>

    <div v-if="error" role="alert" class="alert alert-error alert-soft py-2 text-sm">
      <i class="fas fa-circle-exclamation"></i><span>{{ error }}</span>
    </div>
    <p class="text-xs opacity-60">
      <i class="fas fa-lock mr-1"></i> {{ t('secure') }}
    </p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "pwyw": {
      "legend": "Name your price",
      "hint": "Pay what you want · buyers get every version"
    },
    "buy": {
      "fixed": "Buy · {price}",
      "now": "Buy now"
    },
    "error": {
      "minimum": "Minimum is {price}."
    },
    "secure": "Secure checkout via Stripe. Files unlock instantly.",
    "finalSale": "I understand this is a digital download and that all sales are final."
  },
  "es": {
    "pwyw": {
      "legend": "Elige tu precio",
      "hint": "Paga lo que quieras · los compradores obtienen todas las versiones"
    },
    "buy": {
      "fixed": "Comprar · {price}",
      "now": "Comprar ahora"
    },
    "error": {
      "minimum": "El mínimo es {price}."
    },
    "secure": "Pago seguro a través de Stripe. Los archivos se desbloquean al instante.",
    "finalSale": "Entiendo que esta es una descarga digital y que todas las ventas son definitivas."
  },
  "fr": {
    "pwyw": {
      "legend": "Fixez votre prix",
      "hint": "Payez ce que vous voulez · les acheteurs reçoivent toutes les versions"
    },
    "buy": {
      "fixed": "Acheter · {price}",
      "now": "Acheter maintenant"
    },
    "error": {
      "minimum": "Le minimum est {price}."
    },
    "secure": "Paiement sécurisé via Stripe. Les fichiers se déverrouillent instantanément.",
    "finalSale": "Je comprends qu'il s'agit d'un téléchargement numérique et que toutes les ventes sont définitives."
  },
  "de": {
    "pwyw": {
      "legend": "Preis selbst bestimmen",
      "hint": "Zahle, was du möchtest · Käufer erhalten jede Version"
    },
    "buy": {
      "fixed": "Kaufen · {price}",
      "now": "Jetzt kaufen"
    },
    "error": {
      "minimum": "Mindestbetrag ist {price}."
    },
    "secure": "Sicherer Checkout über Stripe. Dateien werden sofort freigeschaltet.",
    "finalSale": "Mir ist bewusst, dass dies ein digitaler Download ist und alle Verkäufe endgültig sind."
  },
  "it": {
    "pwyw": {
      "legend": "Scegli il tuo prezzo",
      "hint": "Paga quanto vuoi · gli acquirenti ricevono ogni versione"
    },
    "buy": {
      "fixed": "Acquista · {price}",
      "now": "Acquista ora"
    },
    "error": {
      "minimum": "Il minimo è {price}."
    },
    "secure": "Pagamento sicuro tramite Stripe. I file si sbloccano immediatamente.",
    "finalSale": "Capisco che questo è un download digitale e che tutte le vendite sono definitive."
  },
  "pt": {
    "pwyw": {
      "legend": "Defina seu preço",
      "hint": "Pague o que quiser · compradores recebem todas as versões"
    },
    "buy": {
      "fixed": "Comprar · {price}",
      "now": "Comprar agora"
    },
    "error": {
      "minimum": "O mínimo é {price}."
    },
    "secure": "Pagamento seguro via Stripe. Os arquivos são desbloqueados instantaneamente.",
    "finalSale": "Entendo que este é um download digital e que todas as vendas são definitivas."
  },
  "ru": {
    "pwyw": {
      "legend": "Назначьте свою цену",
      "hint": "Платите сколько хотите · покупатели получают все версии"
    },
    "buy": {
      "fixed": "Купить · {price}",
      "now": "Купить сейчас"
    },
    "error": {
      "minimum": "Минимальная сумма — {price}."
    },
    "secure": "Безопасная оплата через Stripe. Файлы открываются мгновенно.",
    "finalSale": "Я понимаю, что это цифровая загрузка и все продажи окончательны, возврату не подлежат."
  },
  "ja": {
    "pwyw": {
      "legend": "価格を設定する",
      "hint": "好きな金額を支払う · 購入者はすべてのバージョンを入手できます"
    },
    "buy": {
      "fixed": "購入 · {price}",
      "now": "今すぐ購入"
    },
    "error": {
      "minimum": "最低金額は{price}です。"
    },
    "secure": "Stripeによる安全な決済。ファイルはすぐにアンロックされます。",
    "finalSale": "これはデジタルダウンロードであり、すべての販売は返金不可（最終確定）であることを理解しています。"
  },
  "zh": {
    "pwyw": {
      "legend": "自定义价格",
      "hint": "随心付费 · 买家获得所有版本"
    },
    "buy": {
      "fixed": "购买 · {price}",
      "now": "立即购买"
    },
    "error": {
      "minimum": "最低金额为 {price}。"
    },
    "secure": "通过 Stripe 安全结账。文件立即解锁。",
    "finalSale": "我了解这是数字下载商品，所有销售均为最终交易，恕不退款。"
  },
  "ko": {
    "pwyw": {
      "legend": "가격을 직접 정하세요",
      "hint": "원하는 만큼 지불 · 구매자는 모든 버전을 받습니다"
    },
    "buy": {
      "fixed": "구매 · {price}",
      "now": "지금 구매"
    },
    "error": {
      "minimum": "최소 금액은 {price}입니다."
    },
    "secure": "Stripe를 통한 안전한 결제. 파일이 즉시 잠금 해제됩니다.",
    "finalSale": "이것이 디지털 다운로드이며 모든 판매가 환불 불가(최종)임을 이해합니다."
  }
}
</i18n>
