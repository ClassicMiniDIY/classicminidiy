<template>
  <div class="space-y-6">
    <!-- Summary Stats -->
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
      <div class="stat">
        <div class="stat-title">{{ t('stats.totalCost') }}</div>
        <div class="stat-value text-success">{{ totalCost === 0 ? t('free') : t('priceUsd', { amount: totalCost }) }}</div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div class="flex gap-2">
      <button type="button" class="btn btn-sm btn-outline" @click="setAllFree">{{ t('actions.allFree') }}</button>
      <button type="button" class="btn btn-sm btn-outline btn-primary" @click="setAllPremium">
        {{ t('actions.allPremium') }}
      </button>
    </div>

    <!-- Tier Table -->
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t('table.listing') }}</th>
            <th>{{ t('table.price') }}</th>
            <th>{{ t('table.tier') }}</th>
            <th class="text-right">{{ t('table.cost') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(listing, index) in listings" :key="listing.id" class="hover">
            <td>
              <div class="flex items-center gap-3">
                <div v-if="listing.photos.length > 0" class="avatar">
                  <div class="mask mask-squircle h-10 w-10">
                    <img :src="listing.photos[0].preview" :alt="listing.title" />
                  </div>
                </div>
                <div v-else class="w-10 h-10 bg-base-300 mask mask-squircle flex items-center justify-center">
                  <i class="fas fa-image text-base-content/30"></i>
                </div>
                <div>
                  <div class="font-medium">{{ listing.title }}</div>
                  <div class="text-sm text-base-content/60">
                    {{ formatPartCondition(listing.partCondition) }}
                  </div>
                </div>
              </div>
            </td>
            <td>
              <span :class="listing.price === 0 ? 'text-success font-medium' : ''">
                {{ listing.price === 0 ? t('free') : t('priceUsd', { amount: listing.price }) }}
              </span>
            </td>
            <td>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                  :checked="listing.tier === 'paid'"
                  @change="toggleTier(index)"
                />
                <span class="text-sm" :class="listing.tier === 'paid' ? 'text-primary font-medium' : ''">
                  {{ listing.tier === 'paid' ? t('tier.premium') : t('tier.free') }}
                </span>
              </label>
            </td>
            <td class="text-right">
              <span v-if="listing.tier === 'paid'" class="font-medium">{{ t('priceUsd', { amount: 10 }) }}</span>
              <span v-else class="text-base-content/40">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Premium Features Callout -->
    <div v-if="premiumCount > 0" class="alert alert-success alert-soft">
      <i class="fas fa-star"></i>
      <div>
        <p class="font-medium">{{ t('callout.selected', { count: premiumCount }) }}</p>
        <p class="text-sm">
          {{ t('callout.features') }}
        </p>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-between pt-4 border-t border-base-300">
      <button type="button" class="btn btn-ghost" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
        {{ t('nav.back') }}
      </button>
      <button type="button" class="btn btn-primary" @click="$emit('next')">
        {{ t('nav.next') }}
        <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { BulkListingItem } from '~/types/bulk';

  const { t } = useI18n();

  const props = defineProps<{
    modelValue: BulkListingItem[];
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: BulkListingItem[]];
    back: [];
    next: [];
  }>();

  const listings = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
  });

  const premiumCount = computed(() => listings.value.filter((l) => l.tier === 'paid').length);
  const freeCount = computed(() => listings.value.filter((l) => l.tier === 'free').length);
  const totalCost = computed(() => premiumCount.value * 10);

  const toggleTier = (index: number) => {
    listings.value[index].tier = listings.value[index].tier === 'paid' ? 'free' : 'paid';
  };

  const setAllFree = () => {
    listings.value.forEach((l) => (l.tier = 'free'));
  };

  const setAllPremium = () => {
    listings.value.forEach((l) => (l.tier = 'paid'));
  };

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
    "stats": { "total": "Total Listings", "free": "Free", "premium": "Premium", "totalCost": "Total Cost" },
    "actions": { "allFree": "All Free", "allPremium": "All Premium" },
    "table": { "listing": "Listing", "price": "Price", "tier": "Tier", "cost": "Cost" },
    "tier": { "premium": "Premium", "free": "Free" },
    "callout": {
      "selected": "{count} Premium listings selected",
      "features": "Premium includes: 15 photos, featured placement for 30 days, priority in search, homepage carousel, featured badge."
    },
    "nav": { "back": "Back to Edit", "next": "Review Listings" },
    "condition": { "new": "New", "usedExcellent": "Used - Excellent", "usedGood": "Used - Good", "usedFair": "Used - Fair", "rebuild": "Rebuild", "core": "Core" }
  },
  "es": {
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Total de anuncios", "free": "Gratis", "premium": "Premium", "totalCost": "Costo total" },
    "actions": { "allFree": "Todos gratis", "allPremium": "Todos premium" },
    "table": { "listing": "Anuncio", "price": "Precio", "tier": "Nivel", "cost": "Costo" },
    "tier": { "premium": "Premium", "free": "Gratis" },
    "callout": {
      "selected": "{count} anuncios premium seleccionados",
      "features": "Premium incluye: 15 fotos, colocación destacada durante 30 días, prioridad en búsquedas, carrusel en la página de inicio e insignia destacada."
    },
    "nav": { "back": "Volver a editar", "next": "Revisar anuncios" },
    "condition": { "new": "Nuevo", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bueno", "usedFair": "Usado - Aceptable", "rebuild": "Reconstruido", "core": "Núcleo" }
  },
  "fr": {
    "free": "Gratuit",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Total des annonces", "free": "Gratuit", "premium": "Premium", "totalCost": "Coût total" },
    "actions": { "allFree": "Tout gratuit", "allPremium": "Tout premium" },
    "table": { "listing": "Annonce", "price": "Prix", "tier": "Niveau", "cost": "Coût" },
    "tier": { "premium": "Premium", "free": "Gratuit" },
    "callout": {
      "selected": "{count} annonces premium sélectionnées",
      "features": "Premium inclut : 15 photos, mise en avant pendant 30 jours, priorité dans la recherche, carrousel en page d'accueil et badge en vedette."
    },
    "nav": { "back": "Retour à l'édition", "next": "Vérifier les annonces" },
    "condition": { "new": "Neuf", "usedExcellent": "Occasion - Excellent", "usedGood": "Occasion - Bon", "usedFair": "Occasion - Correct", "rebuild": "Reconstruit", "core": "Pièce de base" }
  },
  "de": {
    "free": "Kostenlos",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Anzeigen gesamt", "free": "Kostenlos", "premium": "Premium", "totalCost": "Gesamtkosten" },
    "actions": { "allFree": "Alle kostenlos", "allPremium": "Alle Premium" },
    "table": { "listing": "Anzeige", "price": "Preis", "tier": "Stufe", "cost": "Kosten" },
    "tier": { "premium": "Premium", "free": "Kostenlos" },
    "callout": {
      "selected": "{count} Premium-Anzeigen ausgewählt",
      "features": "Premium beinhaltet: 15 Fotos, hervorgehobene Platzierung für 30 Tage, Priorität in der Suche, Startseiten-Karussell und Hervorhebungs-Badge."
    },
    "nav": { "back": "Zurück zum Bearbeiten", "next": "Anzeigen prüfen" },
    "condition": { "new": "Neu", "usedExcellent": "Gebraucht - Ausgezeichnet", "usedGood": "Gebraucht - Gut", "usedFair": "Gebraucht - Akzeptabel", "rebuild": "Überholt", "core": "Grundteil" }
  },
  "it": {
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Annunci totali", "free": "Gratis", "premium": "Premium", "totalCost": "Costo totale" },
    "actions": { "allFree": "Tutti gratis", "allPremium": "Tutti premium" },
    "table": { "listing": "Annuncio", "price": "Prezzo", "tier": "Livello", "cost": "Costo" },
    "tier": { "premium": "Premium", "free": "Gratis" },
    "callout": {
      "selected": "{count} annunci premium selezionati",
      "features": "Premium include: 15 foto, posizionamento in evidenza per 30 giorni, priorità nella ricerca, carosello in homepage e badge in evidenza."
    },
    "nav": { "back": "Torna a modifica", "next": "Rivedi annunci" },
    "condition": { "new": "Nuovo", "usedExcellent": "Usato - Eccellente", "usedGood": "Usato - Buono", "usedFair": "Usato - Discreto", "rebuild": "Ricostruito", "core": "Pezzo base" }
  },
  "pt": {
    "free": "Grátis",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Total de anúncios", "free": "Grátis", "premium": "Premium", "totalCost": "Custo total" },
    "actions": { "allFree": "Todos grátis", "allPremium": "Todos premium" },
    "table": { "listing": "Anúncio", "price": "Preço", "tier": "Nível", "cost": "Custo" },
    "tier": { "premium": "Premium", "free": "Grátis" },
    "callout": {
      "selected": "{count} anúncios premium selecionados",
      "features": "Premium inclui: 15 fotos, destaque por 30 dias, prioridade na busca, carrossel na página inicial e selo de destaque."
    },
    "nav": { "back": "Voltar a editar", "next": "Revisar anúncios" },
    "condition": { "new": "Novo", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bom", "usedFair": "Usado - Razoável", "rebuild": "Recondicionado", "core": "Peça base" }
  },
  "ru": {
    "free": "Бесплатно",
    "priceUsd": "{amount} USD",
    "stats": { "total": "Всего объявлений", "free": "Бесплатно", "premium": "Премиум", "totalCost": "Общая стоимость" },
    "actions": { "allFree": "Все бесплатно", "allPremium": "Все премиум" },
    "table": { "listing": "Объявление", "price": "Цена", "tier": "Уровень", "cost": "Стоимость" },
    "tier": { "premium": "Премиум", "free": "Бесплатно" },
    "callout": {
      "selected": "Выбрано премиум-объявлений: {count}",
      "features": "Премиум включает: 15 фотографий, выделенное размещение на 30 дней, приоритет в поиске, карусель на главной странице и значок выделения."
    },
    "nav": { "back": "Назад к редактированию", "next": "Проверить объявления" },
    "condition": { "new": "Новое", "usedExcellent": "Б/у - Отличное", "usedGood": "Б/у - Хорошее", "usedFair": "Б/у - Удовлетворительное", "rebuild": "Восстановленное", "core": "На запчасти" }
  },
  "ja": {
    "free": "無料",
    "priceUsd": "{amount} USD",
    "stats": { "total": "出品合計", "free": "無料", "premium": "プレミアム", "totalCost": "合計費用" },
    "actions": { "allFree": "すべて無料", "allPremium": "すべてプレミアム" },
    "table": { "listing": "出品", "price": "価格", "tier": "プラン", "cost": "費用" },
    "tier": { "premium": "プレミアム", "free": "無料" },
    "callout": {
      "selected": "プレミアム出品を{count}件選択",
      "features": "プレミアムに含まれるもの：写真15枚、30日間の注目枠掲載、検索での優先表示、ホームページのカルーセル、注目バッジ。"
    },
    "nav": { "back": "編集に戻る", "next": "出品を確認" },
    "condition": { "new": "新品", "usedExcellent": "中古 - 非常に良い", "usedGood": "中古 - 良い", "usedFair": "中古 - 可", "rebuild": "再生品", "core": "コア部品" }
  },
  "zh": {
    "free": "免费",
    "priceUsd": "{amount} 美元",
    "stats": { "total": "刊登总数", "free": "免费", "premium": "高级", "totalCost": "总费用" },
    "actions": { "allFree": "全部免费", "allPremium": "全部高级" },
    "table": { "listing": "刊登", "price": "价格", "tier": "级别", "cost": "费用" },
    "tier": { "premium": "高级", "free": "免费" },
    "callout": {
      "selected": "已选择 {count} 个高级刊登",
      "features": "高级包含：15 张照片、30 天精选展示、搜索优先、首页轮播和精选徽章。"
    },
    "nav": { "back": "返回编辑", "next": "审核刊登" },
    "condition": { "new": "全新", "usedExcellent": "二手 - 极佳", "usedGood": "二手 - 良好", "usedFair": "二手 - 一般", "rebuild": "翻新", "core": "核心件" }
  },
  "ko": {
    "free": "무료",
    "priceUsd": "{amount} USD",
    "stats": { "total": "총 매물", "free": "무료", "premium": "프리미엄", "totalCost": "총 비용" },
    "actions": { "allFree": "모두 무료", "allPremium": "모두 프리미엄" },
    "table": { "listing": "매물", "price": "가격", "tier": "등급", "cost": "비용" },
    "tier": { "premium": "프리미엄", "free": "무료" },
    "callout": {
      "selected": "프리미엄 매물 {count}개 선택됨",
      "features": "프리미엄 포함: 사진 15장, 30일간 추천 노출, 검색 우선 노출, 홈페이지 캐러셀, 추천 배지."
    },
    "nav": { "back": "편집으로 돌아가기", "next": "매물 검토" },
    "condition": { "new": "새 제품", "usedExcellent": "중고 - 최상", "usedGood": "중고 - 양호", "usedFair": "중고 - 보통", "rebuild": "재생", "core": "코어 부품" }
  }
}
</i18n>
