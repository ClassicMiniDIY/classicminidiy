<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';

  // The display-currency preference for marketplace prices. `setUserCurrency`
  // writes localStorage for every visitor and `profiles.preferred_currency` for
  // a signed-in one; `app/plugins/currency.client.ts` reads both back on load.
  const { t } = useI18n();
  const { SUPPORTED_CURRENCIES, userCurrency, setUserCurrency } = useCurrency();
  const { user } = useAuth();

  const justSaved = ref(false);
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  const onChange = async (event: Event) => {
    const code = (event.target as HTMLSelectElement).value as CurrencyCode;
    await setUserCurrency(code, user.value?.id);
    justSaved.value = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (justSaved.value = false), 2500);
  };

  onBeforeUnmount(() => clearTimeout(savedTimer));
</script>

<template>
  <fieldset class="fieldset" data-testid="currency-select">
    <legend class="fieldset-legend text-base">{{ t('title') }}</legend>
    <p class="mb-3 text-sm opacity-70">{{ t('description') }}</p>
    <div class="flex flex-wrap items-center gap-3">
      <select
        class="select select-bordered w-full max-w-xs"
        :value="userCurrency"
        :aria-label="t('title')"
        data-testid="currency-select-input"
        @change="onChange"
      >
        <option v-for="currency in SUPPORTED_CURRENCIES" :key="currency.code" :value="currency.code">
          {{ currency.symbol }} {{ currency.name }} ({{ currency.code }})
        </option>
      </select>
      <span v-if="justSaved" class="text-sm text-success" role="status">
        <i class="fas fa-check" aria-hidden="true"></i>
        {{ t('saved') }}
      </span>
    </div>
    <p class="mt-2 text-xs opacity-60">{{ t('storage_hint') }}</p>
  </fieldset>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Currency",
    "description": "Marketplace prices are converted to this currency. Sellers still set their own currency.",
    "saved": "Saved",
    "storage_hint": "Signed in: saved to your account. Signed out: saved in this browser only."
  },
  "es": {
    "title": "Moneda",
    "description": "Los precios del mercado se convierten a esta moneda. Los vendedores siguen fijando su propia moneda.",
    "saved": "Guardado",
    "storage_hint": "Con sesión iniciada: se guarda en tu cuenta. Sin sesión: solo en este navegador."
  },
  "fr": {
    "title": "Devise",
    "description": "Les prix du marché sont convertis dans cette devise. Les vendeurs gardent leur propre devise.",
    "saved": "Enregistré",
    "storage_hint": "Connecté : enregistré sur votre compte. Déconnecté : enregistré dans ce navigateur uniquement."
  },
  "de": {
    "title": "Währung",
    "description": "Marktplatzpreise werden in diese Währung umgerechnet. Verkäufer legen ihre eigene Währung fest.",
    "saved": "Gespeichert",
    "storage_hint": "Angemeldet: im Konto gespeichert. Abgemeldet: nur in diesem Browser gespeichert."
  },
  "it": {
    "title": "Valuta",
    "description": "I prezzi del mercato sono convertiti in questa valuta. I venditori impostano comunque la propria valuta.",
    "saved": "Salvato",
    "storage_hint": "Con accesso: salvato nel tuo account. Senza accesso: salvato solo in questo browser."
  },
  "pt": {
    "title": "Moeda",
    "description": "Os preços do mercado são convertidos para esta moeda. Os vendedores continuam a definir a própria moeda.",
    "saved": "Salvo",
    "storage_hint": "Com sessão iniciada: salvo na sua conta. Sem sessão: salvo apenas neste navegador."
  },
  "ru": {
    "title": "Валюта",
    "description": "Цены на маркетплейсе пересчитываются в эту валюту. Продавцы по-прежнему указывают свою валюту.",
    "saved": "Сохранено",
    "storage_hint": "При входе: сохраняется в аккаунте. Без входа: только в этом браузере."
  },
  "ja": {
    "title": "通貨",
    "description": "マーケットプレイスの価格はこの通貨に換算されます。出品者は引き続き独自の通貨を設定します。",
    "saved": "保存しました",
    "storage_hint": "ログイン中はアカウントに保存されます。ログアウト中はこのブラウザーにのみ保存されます。"
  },
  "zh": {
    "title": "货币",
    "description": "市场价格将换算为此货币。卖家仍使用自己的货币定价。",
    "saved": "已保存",
    "storage_hint": "已登录：保存到您的账户。未登录：仅保存在此浏览器中。"
  },
  "ko": {
    "title": "통화",
    "description": "마켓플레이스 가격이 이 통화로 환산됩니다. 판매자는 계속 자신의 통화를 설정합니다.",
    "saved": "저장됨",
    "storage_hint": "로그인 시 계정에 저장됩니다. 로그아웃 시 이 브라우저에만 저장됩니다."
  }
}
</i18n>
