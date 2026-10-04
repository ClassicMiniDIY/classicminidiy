<template>
  <fieldset class="fieldset">
    <legend class="fieldset-legend">{{ t('label') }}</legend>
    <label class="flex items-center gap-2 cursor-pointer">
      <input v-model="freeChecked" type="checkbox" class="checkbox checkbox-sm checkbox-primary" />
      <span class="text-sm">{{ t('free') }}</span>
    </label>
    <template v-if="!freeChecked">
      <label class="input w-full mt-2">
        <span class="text-base-content/50">{{ symbol }}</span>
        <input
          v-model.number="amount"
          type="number"
          min="0"
          max="99999999.99"
          step="0.01"
          inputmode="decimal"
          placeholder="15.00"
          class="grow"
          :aria-label="t('amount')"
        />
      </label>
      <p class="label text-base-content/50 text-sm whitespace-normal">{{ t('help') }}</p>
    </template>
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { SUPPORTED_CURRENCIES } from '~/composables/useCurrency';
  import { normalizeShippingCost } from '~/utils/shippingCost';

  const { t } = useI18n();

  const props = defineProps<{
    /** Listing currency code; the symbol is shown before the amount. */
    currency?: string | null;
  }>();

  // 0 = free, null = varies by location, > 0 = flat cost (see utils/shippingCost).
  const model = defineModel<number | null>({ default: null });

  const symbol = computed(() => {
    const code = props.currency || 'USD';
    return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol || code;
  });

  // Only the checkbox sets "free". Deriving it from model === 0 hid the
  // amount field the moment a seller typed the "0" of "0.75". A typed 0 is
  // still stored as 0 (free) and shows ticked on the next load.
  const freeChecked = ref(model.value === 0);
  watch(freeChecked, (free) => {
    if (free) model.value = 0;
    else if (model.value === 0) model.value = null;
  });
  // The parent can replace the value (a draft that loads after mount).
  watch(model, (value) => {
    if (value !== 0 && freeChecked.value) freeChecked.value = false;
  });

  // v-model.number hands back '' for an empty field; store that as null.
  const amount = computed({
    get: () => model.value ?? '',
    set: (value) => {
      model.value = normalizeShippingCost(value);
    },
  });
</script>

<i18n lang="json">
{
  "en": {
    "label": "Shipping Cost",
    "free": "Free shipping",
    "amount": "Shipping cost",
    "help": "Leave blank if the cost varies by location."
  },
  "es": {
    "label": "Costo de envío",
    "free": "Envío gratis",
    "amount": "Costo de envío",
    "help": "Déjalo en blanco si el costo varía según la ubicación."
  },
  "fr": {
    "label": "Frais de livraison",
    "free": "Livraison gratuite",
    "amount": "Frais de livraison",
    "help": "Laissez vide si les frais varient selon la destination."
  },
  "de": {
    "label": "Versandkosten",
    "free": "Kostenloser Versand",
    "amount": "Versandkosten",
    "help": "Leer lassen, wenn die Kosten je nach Zielort variieren."
  },
  "it": {
    "label": "Costo di spedizione",
    "free": "Spedizione gratuita",
    "amount": "Costo di spedizione",
    "help": "Lascia vuoto se il costo varia in base alla destinazione."
  },
  "pt": {
    "label": "Custo de envio",
    "free": "Frete grátis",
    "amount": "Custo de envio",
    "help": "Deixe em branco se o custo variar conforme o local."
  },
  "ru": {
    "label": "Стоимость доставки",
    "free": "Бесплатная доставка",
    "amount": "Стоимость доставки",
    "help": "Оставьте пустым, если стоимость зависит от места доставки."
  },
  "ja": {
    "label": "送料",
    "free": "送料無料",
    "amount": "送料",
    "help": "送料が配送先によって異なる場合は空欄のままにしてください。"
  },
  "zh": {
    "label": "运费",
    "free": "免运费",
    "amount": "运费",
    "help": "如果运费因地点而异，请留空。"
  },
  "ko": {
    "label": "배송비",
    "free": "무료 배송",
    "amount": "배송비",
    "help": "배송비가 지역에 따라 다르면 비워 두세요."
  }
}
</i18n>
