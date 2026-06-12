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

    <button class="btn btn-primary w-full" :disabled="loading" @click="buy">
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
      "hint": "Minimum {price} · buyers get every version"
    },
    "buy": {
      "fixed": "Buy · {price}",
      "now": "Buy now"
    },
    "error": {
      "minimum": "Minimum is {price}."
    },
    "secure": "Secure checkout via Stripe. Files unlock instantly."
  },
  "es": {
    "pwyw": {
      "legend": "Elige tu precio",
      "hint": "Mínimo {price} · los compradores obtienen todas las versiones"
    },
    "buy": {
      "fixed": "Comprar · {price}",
      "now": "Comprar ahora"
    },
    "error": {
      "minimum": "El mínimo es {price}."
    },
    "secure": "Pago seguro a través de Stripe. Los archivos se desbloquean al instante."
  },
  "fr": {
    "pwyw": {
      "legend": "Fixez votre prix",
      "hint": "Minimum {price} · les acheteurs reçoivent toutes les versions"
    },
    "buy": {
      "fixed": "Acheter · {price}",
      "now": "Acheter maintenant"
    },
    "error": {
      "minimum": "Le minimum est {price}."
    },
    "secure": "Paiement sécurisé via Stripe. Les fichiers se déverrouillent instantanément."
  },
  "de": {
    "pwyw": {
      "legend": "Preis selbst bestimmen",
      "hint": "Mindestens {price} · Käufer erhalten jede Version"
    },
    "buy": {
      "fixed": "Kaufen · {price}",
      "now": "Jetzt kaufen"
    },
    "error": {
      "minimum": "Mindestbetrag ist {price}."
    },
    "secure": "Sicherer Checkout über Stripe. Dateien werden sofort freigeschaltet."
  },
  "it": {
    "pwyw": {
      "legend": "Scegli il tuo prezzo",
      "hint": "Minimo {price} · gli acquirenti ricevono ogni versione"
    },
    "buy": {
      "fixed": "Acquista · {price}",
      "now": "Acquista ora"
    },
    "error": {
      "minimum": "Il minimo è {price}."
    },
    "secure": "Pagamento sicuro tramite Stripe. I file si sbloccano immediatamente."
  },
  "pt": {
    "pwyw": {
      "legend": "Defina seu preço",
      "hint": "Mínimo {price} · compradores recebem todas as versões"
    },
    "buy": {
      "fixed": "Comprar · {price}",
      "now": "Comprar agora"
    },
    "error": {
      "minimum": "O mínimo é {price}."
    },
    "secure": "Pagamento seguro via Stripe. Os arquivos são desbloqueados instantaneamente."
  },
  "ru": {
    "pwyw": {
      "legend": "Назначьте свою цену",
      "hint": "Минимум {price} · покупатели получают все версии"
    },
    "buy": {
      "fixed": "Купить · {price}",
      "now": "Купить сейчас"
    },
    "error": {
      "minimum": "Минимальная сумма — {price}."
    },
    "secure": "Безопасная оплата через Stripe. Файлы открываются мгновенно."
  },
  "ja": {
    "pwyw": {
      "legend": "価格を設定する",
      "hint": "最低{price} · 購入者はすべてのバージョンを入手できます"
    },
    "buy": {
      "fixed": "購入 · {price}",
      "now": "今すぐ購入"
    },
    "error": {
      "minimum": "最低金額は{price}です。"
    },
    "secure": "Stripeによる安全な決済。ファイルはすぐにアンロックされます。"
  },
  "zh": {
    "pwyw": {
      "legend": "自定义价格",
      "hint": "最低 {price} · 买家获得所有版本"
    },
    "buy": {
      "fixed": "购买 · {price}",
      "now": "立即购买"
    },
    "error": {
      "minimum": "最低金额为 {price}。"
    },
    "secure": "通过 Stripe 安全结账。文件立即解锁。"
  },
  "ko": {
    "pwyw": {
      "legend": "가격을 직접 정하세요",
      "hint": "최소 {price} · 구매자는 모든 버전을 받습니다"
    },
    "buy": {
      "fixed": "구매 · {price}",
      "now": "지금 구매"
    },
    "error": {
      "minimum": "최소 금액은 {price}입니다."
    },
    "secure": "Stripe를 통한 안전한 결제. 파일이 즉시 잠금 해제됩니다."
  }
}
</i18n>
