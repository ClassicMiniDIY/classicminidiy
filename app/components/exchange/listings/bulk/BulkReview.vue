<template>
  <div class="space-y-6">
    <!-- Submission Progress Overlay -->
    <div v-if="submitting" class="text-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="mt-4 text-lg font-medium">
        {{ t('progress.creating', { current: submissionProgress.current, total: submissionProgress.total }) }}
      </p>
      <progress
        class="progress progress-primary w-64 mx-auto mt-4"
        :value="submissionProgress.current"
        :max="submissionProgress.total"
      ></progress>
    </div>

    <!-- Review Content -->
    <template v-else>
      <!-- Summary -->
      <div class="stats stats-vertical sm:stats-horizontal shadow w-full">
        <div class="stat">
          <div class="stat-title">{{ t('stats.total') }}</div>
          <div class="stat-value text-primary">{{ listings.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">{{ t('stats.free') }}</div>
          <div class="stat-value">{{ freeCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">{{ t('stats.premium') }}</div>
          <div class="stat-value text-warning">{{ premiumCount }}</div>
        </div>
        <div v-if="premiumCount > 0" class="stat">
          <div class="stat-title">{{ t('stats.paymentDue') }}</div>
          <div class="stat-value text-success">{{ t('priceUsd', { amount: premiumCount * 10 }) }}</div>
        </div>
      </div>

      <!-- Listings Table -->
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>{{ t('table.photo') }}</th>
              <th>{{ t('table.title') }}</th>
              <th>{{ t('table.price') }}</th>
              <th>{{ t('table.condition') }}</th>
              <th>{{ t('table.tier') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="listing in listings" :key="listing.id">
              <td>
                <div v-if="listing.photos.length > 0" class="avatar">
                  <div class="mask mask-squircle h-12 w-12">
                    <img :src="listing.photos[0].preview" :alt="listing.title" />
                  </div>
                </div>
                <div v-else class="w-12 h-12 bg-base-300 mask mask-squircle flex items-center justify-center">
                  <i class="fas fa-image text-base-content/30"></i>
                </div>
              </td>
              <td>
                <div class="font-medium">{{ listing.title }}</div>
                <div class="text-xs text-base-content/60">
                  {{ t('photoCount', { count: listing.photos.length }) }}
                  <span v-if="listing.location.city"> &middot; {{ listing.location.city }}</span>
                </div>
              </td>
              <td>
                <span :class="listing.price === 0 ? 'text-success' : ''">
                  {{ listing.price === 0 ? t('free') : t('priceUsd', { amount: listing.price }) }}
                </span>
              </td>
              <td>
                <span class="badge badge-ghost badge-sm">{{ formatPartCondition(listing.partCondition) }}</span>
              </td>
              <td>
                <span v-if="listing.tier === 'paid'" class="badge badge-primary badge-sm">{{ t('tier.premium') }}</span>
                <span v-else class="badge badge-ghost badge-sm">{{ t('tier.free') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment Notice -->
      <div v-if="premiumCount > 0" class="alert alert-info alert-soft">
        <i class="fas fa-credit-card"></i>
        <span>
          {{ t('paymentNotice.lead') }}
          <strong>{{ t('priceUsd', { amount: premiumCount * 10 }) }}</strong>
          {{ t('paymentNotice.trail', { count: premiumCount }) }}
        </span>
      </div>

      <!-- Navigation -->
      <div class="flex justify-between pt-4 border-t border-base-300">
        <button type="button" class="btn btn-ghost" @click="$emit('back')">
          <i class="fas fa-arrow-left"></i>
          {{ t('nav.back') }}
        </button>
        <button type="button" class="btn btn-primary btn-lg" @click="$emit('submit')">
          <i class="fas fa-paper-plane"></i>
          {{
            premiumCount > 0
              ? t('nav.submitAndPay', { amount: premiumCount * 10 })
              : t('nav.submit', { count: listings.length })
          }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { BulkListingItem } from '~/types/bulk';

  const { t } = useI18n();

  const props = defineProps<{
    listings: BulkListingItem[];
    submitting: boolean;
    submissionProgress: { current: number; total: number };
  }>();

  defineEmits<{
    back: [];
    submit: [];
  }>();

  const premiumCount = computed(() => props.listings.filter((l) => l.tier === 'paid').length);

  const freeCount = computed(() => props.listings.filter((l) => l.tier === 'free').length);

  const formatPartCondition = (condition: string) => {
    const labels: Record<string, string> = {
      new: t('condition.new'),
      used_excellent: t('condition.usedExcellent'),
      used_good: t('condition.usedGood'),
      used_fair: t('condition.usedFair'),
      rebuild: t('condition.rebuild'),
      core: t('condition.core'),
    };
    return labels[condition] || condition;
  };
</script>

<i18n lang="json">
{
  "en": {
    "free": "Free",
    "priceUsd": "${amount}",
    "progress": { "creating": "Creating listing {current} of {total}..." },
    "stats": { "total": "Total Listings", "free": "Free", "premium": "Premium", "paymentDue": "Payment Due" },
    "table": { "photo": "Photo", "title": "Title", "price": "Price", "condition": "Condition", "tier": "Tier" },
    "photoCount": "{count} photos",
    "tier": { "premium": "Premium", "free": "Free" },
    "paymentNotice": {
      "lead": "You'll be redirected to Stripe to pay",
      "trail": "for {count} premium listings. Free listings will be submitted for review immediately."
    },
    "nav": { "back": "Back to Tiers", "submitAndPay": "Submit & Pay ${amount}", "submit": "Submit {count} Listings" },
    "condition": { "new": "New", "usedExcellent": "Used - Excellent", "usedGood": "Used - Good", "usedFair": "Used - Fair", "rebuild": "Rebuild", "core": "Core" }
  },
  "es": {
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Creando anuncio {current} de {total}..." },
    "stats": { "total": "Total de anuncios", "free": "Gratis", "premium": "Premium", "paymentDue": "Pago pendiente" },
    "table": { "photo": "Foto", "title": "Título", "price": "Precio", "condition": "Condición", "tier": "Nivel" },
    "photoCount": "{count} fotos",
    "tier": { "premium": "Premium", "free": "Gratis" },
    "paymentNotice": {
      "lead": "Se te redirigirá a Stripe para pagar",
      "trail": "por {count} anuncios premium. Los anuncios gratuitos se enviarán a revisión de inmediato."
    },
    "nav": { "back": "Volver a niveles", "submitAndPay": "Enviar y pagar {amount} USD", "submit": "Enviar {count} anuncios" },
    "condition": { "new": "Nuevo", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bueno", "usedFair": "Usado - Aceptable", "rebuild": "Reconstruido", "core": "Núcleo" }
  },
  "fr": {
    "free": "Gratuit",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Création de l'annonce {current} sur {total}..." },
    "stats": { "total": "Total des annonces", "free": "Gratuit", "premium": "Premium", "paymentDue": "Paiement dû" },
    "table": { "photo": "Photo", "title": "Titre", "price": "Prix", "condition": "État", "tier": "Niveau" },
    "photoCount": "{count} photos",
    "tier": { "premium": "Premium", "free": "Gratuit" },
    "paymentNotice": {
      "lead": "Vous serez redirigé vers Stripe pour payer",
      "trail": "pour {count} annonces premium. Les annonces gratuites seront soumises à l'examen immédiatement."
    },
    "nav": { "back": "Retour aux niveaux", "submitAndPay": "Soumettre et payer {amount} USD", "submit": "Soumettre {count} annonces" },
    "condition": { "new": "Neuf", "usedExcellent": "Occasion - Excellent", "usedGood": "Occasion - Bon", "usedFair": "Occasion - Correct", "rebuild": "Reconstruit", "core": "Pièce de base" }
  },
  "de": {
    "free": "Kostenlos",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Anzeige {current} von {total} wird erstellt..." },
    "stats": { "total": "Anzeigen gesamt", "free": "Kostenlos", "premium": "Premium", "paymentDue": "Fällige Zahlung" },
    "table": { "photo": "Foto", "title": "Titel", "price": "Preis", "condition": "Zustand", "tier": "Stufe" },
    "photoCount": "{count} Fotos",
    "tier": { "premium": "Premium", "free": "Kostenlos" },
    "paymentNotice": {
      "lead": "Sie werden zu Stripe weitergeleitet, um",
      "trail": "für {count} Premium-Anzeigen zu zahlen. Kostenlose Anzeigen werden sofort zur Prüfung eingereicht."
    },
    "nav": { "back": "Zurück zu den Stufen", "submitAndPay": "Absenden & {amount} USD zahlen", "submit": "{count} Anzeigen absenden" },
    "condition": { "new": "Neu", "usedExcellent": "Gebraucht - Ausgezeichnet", "usedGood": "Gebraucht - Gut", "usedFair": "Gebraucht - Akzeptabel", "rebuild": "Überholt", "core": "Grundteil" }
  },
  "it": {
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Creazione annuncio {current} di {total}..." },
    "stats": { "total": "Annunci totali", "free": "Gratis", "premium": "Premium", "paymentDue": "Pagamento dovuto" },
    "table": { "photo": "Foto", "title": "Titolo", "price": "Prezzo", "condition": "Condizione", "tier": "Livello" },
    "photoCount": "{count} foto",
    "tier": { "premium": "Premium", "free": "Gratis" },
    "paymentNotice": {
      "lead": "Verrai reindirizzato a Stripe per pagare",
      "trail": "per {count} annunci premium. Gli annunci gratuiti verranno inviati subito per la revisione."
    },
    "nav": { "back": "Torna ai livelli", "submitAndPay": "Invia e paga {amount} USD", "submit": "Invia {count} annunci" },
    "condition": { "new": "Nuovo", "usedExcellent": "Usato - Eccellente", "usedGood": "Usato - Buono", "usedFair": "Usato - Discreto", "rebuild": "Ricostruito", "core": "Pezzo base" }
  },
  "pt": {
    "free": "Grátis",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Criando anúncio {current} de {total}..." },
    "stats": { "total": "Total de anúncios", "free": "Grátis", "premium": "Premium", "paymentDue": "Pagamento devido" },
    "table": { "photo": "Foto", "title": "Título", "price": "Preço", "condition": "Condição", "tier": "Nível" },
    "photoCount": "{count} fotos",
    "tier": { "premium": "Premium", "free": "Grátis" },
    "paymentNotice": {
      "lead": "Você será redirecionado para o Stripe para pagar",
      "trail": "por {count} anúncios premium. Anúncios gratuitos serão enviados para análise imediatamente."
    },
    "nav": { "back": "Voltar aos níveis", "submitAndPay": "Enviar e pagar {amount} USD", "submit": "Enviar {count} anúncios" },
    "condition": { "new": "Novo", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bom", "usedFair": "Usado - Razoável", "rebuild": "Recondicionado", "core": "Peça base" }
  },
  "ru": {
    "free": "Бесплатно",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "Создание объявления {current} из {total}..." },
    "stats": { "total": "Всего объявлений", "free": "Бесплатно", "premium": "Премиум", "paymentDue": "К оплате" },
    "table": { "photo": "Фото", "title": "Название", "price": "Цена", "condition": "Состояние", "tier": "Уровень" },
    "photoCount": "Фотографий: {count}",
    "tier": { "premium": "Премиум", "free": "Бесплатно" },
    "paymentNotice": {
      "lead": "Вы будете перенаправлены в Stripe для оплаты",
      "trail": "за {count} премиум-объявлений. Бесплатные объявления будут отправлены на проверку немедленно."
    },
    "nav": { "back": "Назад к уровням", "submitAndPay": "Отправить и оплатить {amount} USD", "submit": "Отправить объявлений: {count}" },
    "condition": { "new": "Новое", "usedExcellent": "Б/у - Отличное", "usedGood": "Б/у - Хорошее", "usedFair": "Б/у - Удовлетворительное", "rebuild": "Восстановленное", "core": "На запчасти" }
  },
  "ja": {
    "free": "無料",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "出品を作成中 {current}/{total}..." },
    "stats": { "total": "出品合計", "free": "無料", "premium": "プレミアム", "paymentDue": "支払い予定額" },
    "table": { "photo": "写真", "title": "タイトル", "price": "価格", "condition": "状態", "tier": "プラン" },
    "photoCount": "写真{count}枚",
    "tier": { "premium": "プレミアム", "free": "無料" },
    "paymentNotice": {
      "lead": "Stripe にリダイレクトされ、",
      "trail": "{count}件のプレミアム出品の料金をお支払いいただきます。無料出品はすぐに審査に提出されます。"
    },
    "nav": { "back": "プランに戻る", "submitAndPay": "送信して{amount} USDを支払う", "submit": "{count}件の出品を送信" },
    "condition": { "new": "新品", "usedExcellent": "中古 - 非常に良い", "usedGood": "中古 - 良い", "usedFair": "中古 - 可", "rebuild": "再生品", "core": "コア部品" }
  },
  "zh": {
    "free": "免费",
    "priceUsd": "{amount} 美元",
    "progress": { "creating": "正在创建刊登 {current}/{total}..." },
    "stats": { "total": "刊登总数", "free": "免费", "premium": "高级", "paymentDue": "应付款" },
    "table": { "photo": "照片", "title": "标题", "price": "价格", "condition": "状况", "tier": "级别" },
    "photoCount": "{count} 张照片",
    "tier": { "premium": "高级", "free": "免费" },
    "paymentNotice": {
      "lead": "您将被重定向到 Stripe 以支付",
      "trail": "{count} 个高级刊登的费用。免费刊登将立即提交审核。"
    },
    "nav": { "back": "返回级别", "submitAndPay": "提交并支付 {amount} 美元", "submit": "提交 {count} 个刊登" },
    "condition": { "new": "全新", "usedExcellent": "二手 - 极佳", "usedGood": "二手 - 良好", "usedFair": "二手 - 一般", "rebuild": "翻新", "core": "核心件" }
  },
  "ko": {
    "free": "무료",
    "priceUsd": "{amount} USD",
    "progress": { "creating": "매물 생성 중 {current}/{total}..." },
    "stats": { "total": "총 매물", "free": "무료", "premium": "프리미엄", "paymentDue": "결제 예정액" },
    "table": { "photo": "사진", "title": "제목", "price": "가격", "condition": "상태", "tier": "등급" },
    "photoCount": "사진 {count}장",
    "tier": { "premium": "프리미엄", "free": "무료" },
    "paymentNotice": {
      "lead": "Stripe로 이동하여",
      "trail": "프리미엄 매물 {count}개의 비용을 결제합니다. 무료 매물은 즉시 검토를 위해 제출됩니다."
    },
    "nav": { "back": "등급으로 돌아가기", "submitAndPay": "제출 후 {amount} USD 결제", "submit": "매물 {count}개 제출" },
    "condition": { "new": "새 제품", "usedExcellent": "중고 - 최상", "usedGood": "중고 - 양호", "usedFair": "중고 - 보통", "rebuild": "재생", "core": "코어 부품" }
  }
}
</i18n>
