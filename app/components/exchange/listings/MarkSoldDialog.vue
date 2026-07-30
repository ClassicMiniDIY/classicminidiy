<script setup lang="ts">
  /**
   * Mark-as-sold confirmation, with sale-price capture.
   *
   * Why this exists rather than the generic ExchangeConfirmDialog: marking a listing
   * sold used to write only `status` and `sold_date`, so `final_price` was never
   * populated by any code path in the app. That left /exchange/sold unable to be what
   * a sold archive is actually good for — a pricing reference other owners search for
   * ("what did a Cooper S go for") — and is why that page is still noindex.
   *
   * The price is OPTIONAL on purpose. Forcing a number on a seller who doesn't want to
   * disclose one produces junk (1, 99999) and quietly poisons the archive; fewer honest
   * figures are worth more than a complete column of guesses. The public-visibility
   * warning is deliberately unmissable — this is a private individual publishing what
   * they got for their car, and they must not discover that after the fact.
   */
  interface Props {
    /** ISO currency of the listing, used for the input prefix. */
    currency?: string;
    /** Asking price, offered as a starting point so the common case is one tap. */
    askingPrice?: number | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    currency: 'USD',
    askingPrice: null,
  });

  const emit = defineEmits<{
    /** Emitted with the sale price, or null when the seller declines to give one. */
    confirm: [finalPrice: number | null];
    cancel: [];
  }>();

  const { t } = useI18n();

  const dialogRef = ref<HTMLDialogElement | null>(null);
  const priceInput = ref<string>('');
  const touched = ref(false);

  const currencySymbol = computed(() => {
    try {
      // Extract just the symbol so the input can show it as a prefix.
      return (
        new Intl.NumberFormat('en-US', { style: 'currency', currency: props.currency })
          .formatToParts(0)
          .find((p) => p.type === 'currency')?.value ?? '$'
      );
    } catch {
      return '$';
    }
  });

  /** null = intentionally blank; NaN = present but unparseable. */
  const parsedPrice = computed(() => {
    const raw = priceInput.value.replace(/[^0-9.]/g, '').trim();
    if (!raw) return null;
    return Number(raw);
  });

  const error = computed(() => {
    if (!touched.value) return '';
    const value = parsedPrice.value;
    if (value === null) return '';
    if (!Number.isFinite(value) || value <= 0) return t('error.invalid');
    if (value > 10_000_000) return t('error.tooLarge');
    return '';
  });

  const canConfirm = computed(() => !error.value);

  const show = () => {
    priceInput.value = props.askingPrice != null ? String(props.askingPrice) : '';
    touched.value = false;
    dialogRef.value?.showModal();
  };

  const hide = () => dialogRef.value?.close();

  const handleConfirm = () => {
    touched.value = true;
    if (!canConfirm.value) return;
    const value = parsedPrice.value;
    hide();
    emit('confirm', value !== null && Number.isFinite(value) ? value : null);
  };

  const handleCancel = () => {
    hide();
    emit('cancel');
  };

  defineExpose({ show, hide });
</script>

<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ t('title') }}</h3>
      <p class="pt-3 pb-1 text-base-content/80">{{ t('intro') }}</p>

      <fieldset class="fieldset mt-3">
        <label class="label" for="mark-sold-price">
          <span class="label-text font-medium">{{ t('priceLabel') }}</span>
        </label>
        <label class="input input-bordered flex items-center gap-2 w-full">
          <span class="text-base-content/60">{{ currencySymbol }}</span>
          <input
            id="mark-sold-price"
            v-model="priceInput"
            type="text"
            inputmode="decimal"
            class="grow"
            :placeholder="t('pricePlaceholder')"
            :aria-invalid="!!error"
            aria-describedby="mark-sold-price-help"
            @blur="touched = true"
          />
          <span class="text-base-content/60 text-sm">{{ currency }}</span>
        </label>
        <p v-if="error" class="text-error text-sm mt-1" role="alert">{{ error }}</p>
        <p id="mark-sold-price-help" class="text-base-content/60 text-sm mt-1">
          {{ t('priceHelp') }}
        </p>
      </fieldset>

      <div role="note" class="alert alert-warning mt-4 text-sm">
        <i class="fas fa-eye" aria-hidden="true"></i>
        <span>{{ t('publicWarning') }}</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="handleCancel">{{ t('cancel') }}</button>
        <button class="btn btn-success" :disabled="!canConfirm" @click="handleConfirm">
          {{ t('confirm') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="handleCancel">close</button>
    </form>
  </dialog>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Mark as Sold",
    "intro": "Congratulations on your sale. Adding what it sold for helps other Classic Mini owners judge what their car is worth.",
    "priceLabel": "Sold price",
    "pricePlaceholder": "Leave blank to skip",
    "priceHelp": "Optional. Enter the amount it actually sold for, not the asking price.",
    "publicWarning": "The sold price is shown publicly in the sold archive.",
    "confirm": "Mark Sold",
    "cancel": "Cancel",
    "error": { "invalid": "Enter an amount greater than zero.", "tooLarge": "That amount looks too large." }
  },
  "es": {
    "title": "Marcar como vendido",
    "intro": "Enhorabuena por tu venta. Indicar el precio de venta ayuda a otros propietarios de Mini clásicos a valorar su coche.",
    "priceLabel": "Precio de venta",
    "pricePlaceholder": "Déjalo vacío para omitir",
    "priceHelp": "Opcional. Indica el importe por el que se vendió realmente, no el precio pedido.",
    "publicWarning": "El precio de venta se muestra públicamente en el archivo de vendidos.",
    "confirm": "Marcar como vendido",
    "cancel": "Cancelar",
    "error": { "invalid": "Introduce un importe mayor que cero.", "tooLarge": "Ese importe parece demasiado alto." }
  },
  "fr": {
    "title": "Marquer comme vendu",
    "intro": "Félicitations pour votre vente. Indiquer le prix de vente aide les autres propriétaires de Mini classiques à estimer leur voiture.",
    "priceLabel": "Prix de vente",
    "pricePlaceholder": "Laisser vide pour ignorer",
    "priceHelp": "Facultatif. Indiquez le montant réellement obtenu, pas le prix demandé.",
    "publicWarning": "Le prix de vente est affiché publiquement dans les archives des ventes.",
    "confirm": "Marquer comme vendu",
    "cancel": "Annuler",
    "error": { "invalid": "Saisissez un montant supérieur à zéro.", "tooLarge": "Ce montant semble trop élevé." }
  },
  "de": {
    "title": "Als verkauft markieren",
    "intro": "Glückwunsch zum Verkauf. Der Verkaufspreis hilft anderen Classic-Mini-Besitzern, den Wert ihres Autos einzuschätzen.",
    "priceLabel": "Verkaufspreis",
    "pricePlaceholder": "Leer lassen zum Überspringen",
    "priceHelp": "Optional. Gib den tatsächlich erzielten Betrag an, nicht den geforderten Preis.",
    "publicWarning": "Der Verkaufspreis wird im Verkaufsarchiv öffentlich angezeigt.",
    "confirm": "Als verkauft markieren",
    "cancel": "Abbrechen",
    "error": { "invalid": "Gib einen Betrag größer als null ein.", "tooLarge": "Dieser Betrag scheint zu hoch." }
  },
  "it": {
    "title": "Segna come venduto",
    "intro": "Congratulazioni per la vendita. Indicare il prezzo di vendita aiuta altri proprietari di Mini classiche a valutare la propria auto.",
    "priceLabel": "Prezzo di vendita",
    "pricePlaceholder": "Lascia vuoto per saltare",
    "priceHelp": "Facoltativo. Inserisci l'importo effettivamente realizzato, non il prezzo richiesto.",
    "publicWarning": "Il prezzo di vendita è mostrato pubblicamente nell'archivio dei venduti.",
    "confirm": "Segna come venduto",
    "cancel": "Annulla",
    "error": { "invalid": "Inserisci un importo maggiore di zero.", "tooLarge": "Questo importo sembra troppo alto." }
  },
  "pt": {
    "title": "Marcar como vendido",
    "intro": "Parabéns pela venda. Indicar o preço de venda ajuda outros proprietários de Mini clássicos a avaliar o seu carro.",
    "priceLabel": "Preço de venda",
    "pricePlaceholder": "Deixe em branco para ignorar",
    "priceHelp": "Opcional. Indique o valor pelo qual foi realmente vendido, não o preço pedido.",
    "publicWarning": "O preço de venda é apresentado publicamente no arquivo de vendidos.",
    "confirm": "Marcar como vendido",
    "cancel": "Cancelar",
    "error": { "invalid": "Introduza um valor maior que zero.", "tooLarge": "Esse valor parece demasiado alto." }
  },
  "ru": {
    "title": "Отметить как проданное",
    "intro": "Поздравляем с продажей. Указание цены продажи помогает другим владельцам классического Mini оценить свою машину.",
    "priceLabel": "Цена продажи",
    "pricePlaceholder": "Оставьте пустым, чтобы пропустить",
    "priceHelp": "Необязательно. Укажите сумму, за которую автомобиль действительно продан, а не запрашиваемую цену.",
    "publicWarning": "Цена продажи публично отображается в архиве проданных.",
    "confirm": "Отметить как проданное",
    "cancel": "Отмена",
    "error": { "invalid": "Введите сумму больше нуля.", "tooLarge": "Эта сумма выглядит слишком большой." }
  },
  "ja": {
    "title": "売却済みにする",
    "intro": "ご成約おめでとうございます。売却価格を入力すると、他のクラシック・ミニのオーナーが自分の車の価値を判断する助けになります。",
    "priceLabel": "売却価格",
    "pricePlaceholder": "空欄のままでスキップ",
    "priceHelp": "任意です。希望価格ではなく、実際に売れた金額を入力してください。",
    "publicWarning": "売却価格は売却済みアーカイブで公開されます。",
    "confirm": "売却済みにする",
    "cancel": "キャンセル",
    "error": { "invalid": "0 より大きい金額を入力してください。", "tooLarge": "金額が大きすぎるようです。" }
  },
  "zh": {
    "title": "标记为已售出",
    "intro": "恭喜成交。填写成交价可以帮助其他经典 Mini 车主判断自己车辆的价值。",
    "priceLabel": "成交价",
    "pricePlaceholder": "留空则跳过",
    "priceHelp": "选填。请填写实际成交金额，而非要价。",
    "publicWarning": "成交价会在已售出档案中公开显示。",
    "confirm": "标记为已售出",
    "cancel": "取消",
    "error": { "invalid": "请输入大于零的金额。", "tooLarge": "该金额看起来过大。" }
  },
  "ko": {
    "title": "판매 완료로 표시",
    "intro": "판매를 축하합니다. 판매 가격을 입력하면 다른 클래식 미니 오너들이 자기 차의 가치를 판단하는 데 도움이 됩니다.",
    "priceLabel": "판매 가격",
    "pricePlaceholder": "비워 두면 건너뜁니다",
    "priceHelp": "선택 사항입니다. 희망 가격이 아니라 실제로 판매된 금액을 입력하세요.",
    "publicWarning": "판매 가격은 판매 완료 아카이브에 공개적으로 표시됩니다.",
    "confirm": "판매 완료로 표시",
    "cancel": "취소",
    "error": { "invalid": "0보다 큰 금액을 입력하세요.", "tooLarge": "금액이 너무 큰 것 같습니다." }
  }
}
</i18n>
