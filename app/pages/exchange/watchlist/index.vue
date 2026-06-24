<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-4xl font-bold mb-2">{{ t('header.title') }}</h1>
            <p class="text-base-content/70">
              {{ t('header.savedCount', { count: watchlistItems.length }, watchlistItems.length) }}
            </p>
          </div>
          <NuxtLink to="/exchange/listings" class="btn btn-outline">
            <i class="fas fa-magnifying-glass"></i>
            {{ t('browse') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="skeleton h-80 w-full"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="watchlistItems.length === 0" class="text-center py-16">
          <i class="fas fa-heart text-6xl mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
          <p class="text-base-content/70 mb-6">{{ t('empty.body') }}</p>
          <NuxtLink to="/exchange/listings" class="btn btn-primary">
            <i class="fas fa-magnifying-glass"></i>
            {{ t('browse') }}
          </NuxtLink>
        </div>

        <!-- Watchlist Grid -->
        <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <template v-for="item in watchlistItems" :key="item.listing_id">
            <ExchangeListingsListingCard
              v-if="item.listing"
              :listing="item.listing"
              :show-remove-button="true"
              :remove-loading="removingId === item.listing_id"
              :user-currency="userCurrency"
              @remove="handleRemove(item.listing_id)"
            />
          </template>
        </div>

        <!-- Info Banner -->
        <div v-if="!loading && watchlistItems.length > 0" class="alert alert-info mt-8">
          <i class="fas fa-circle-info"></i>
          <span>{{ t('info') }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  const { watchlistItems, fetchWatchlist, removeFromWatchlist } = useWatchlist();
  const { user } = useAuth();
  const { capture } = usePostHog();
  const loading = ref(true);
  const removingId = ref<string | null>(null);
  const hasTrackedView = ref(false);

  const { userCurrency } = useCurrency();

  // Fetch watchlist on mount
  onMounted(async () => {
    if (user.value) {
      await fetchWatchlist();
    }
    loading.value = false;
  });

  // Track watchlist view once items are loaded
  watch(
    () => watchlistItems.value,
    (items) => {
      if (items && !loading.value && !hasTrackedView.value) {
        capture('watchlist_viewed', {
          item_count: items.length,
        });
        hasTrackedView.value = true;
      }
    },
    { immediate: true }
  );

  // Handle removing an item
  const handleRemove = async (listingId: string) => {
    removingId.value = listingId;
    try {
      await removeFromWatchlist(listingId);
    } finally {
      removingId.value = null;
    }
  };

  // SEO metadata - noindex for user-specific pages
  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    robots: 'noindex, nofollow',
  });
</script>

<i18n lang="json">
{
  "en": {
    "header": { "title": "My Watchlist", "savedCount": "{count} saved listing | {count} saved listings" },
    "browse": "Browse Listings",
    "empty": { "title": "No saved listings yet", "body": "Start browsing and save listings you're interested in" },
    "info": "You'll be notified when prices change or listings are about to expire",
    "seo": { "title": "My Watchlist - The Mini Exchange", "description": "View and manage your saved Classic Mini listings" }
  },
  "es": {
    "header": { "title": "Mi lista de seguimiento", "savedCount": "{count} anuncio guardado | {count} anuncios guardados" },
    "browse": "Explorar anuncios",
    "empty": { "title": "Aún no tienes anuncios guardados", "body": "Empieza a explorar y guarda los anuncios que te interesen" },
    "info": "Te avisaremos cuando cambien los precios o los anuncios estén a punto de expirar",
    "seo": { "title": "Mi lista de seguimiento - The Mini Exchange", "description": "Consulta y gestiona tus anuncios guardados de Classic Mini" }
  },
  "fr": {
    "header": { "title": "Ma liste de suivi", "savedCount": "{count} annonce enregistrée | {count} annonces enregistrées" },
    "browse": "Parcourir les annonces",
    "empty": { "title": "Aucune annonce enregistrée pour le moment", "body": "Commencez à parcourir et enregistrez les annonces qui vous intéressent" },
    "info": "Vous serez averti lorsque les prix changent ou que les annonces sont sur le point d'expirer",
    "seo": { "title": "Ma liste de suivi - The Mini Exchange", "description": "Consultez et gérez vos annonces Classic Mini enregistrées" }
  },
  "de": {
    "header": { "title": "Meine Merkliste", "savedCount": "{count} gespeichertes Inserat | {count} gespeicherte Inserate" },
    "browse": "Inserate durchsuchen",
    "empty": { "title": "Noch keine gespeicherten Inserate", "body": "Stöbere los und speichere Inserate, die dich interessieren" },
    "info": "Wir benachrichtigen dich, wenn sich Preise ändern oder Inserate bald ablaufen",
    "seo": { "title": "Meine Merkliste - The Mini Exchange", "description": "Sieh dir deine gespeicherten Classic-Mini-Inserate an und verwalte sie" }
  },
  "it": {
    "header": { "title": "I miei preferiti", "savedCount": "{count} annuncio salvato | {count} annunci salvati" },
    "browse": "Esplora gli annunci",
    "empty": { "title": "Nessun annuncio salvato", "body": "Inizia a esplorare e salva gli annunci che ti interessano" },
    "info": "Ti avviseremo quando i prezzi cambiano o gli annunci stanno per scadere",
    "seo": { "title": "I miei preferiti - The Mini Exchange", "description": "Visualizza e gestisci i tuoi annunci Classic Mini salvati" }
  },
  "pt": {
    "header": { "title": "Minha lista de favoritos", "savedCount": "{count} anúncio salvo | {count} anúncios salvos" },
    "browse": "Explorar anúncios",
    "empty": { "title": "Nenhum anúncio salvo ainda", "body": "Comece a explorar e salve os anúncios do seu interesse" },
    "info": "Você será notificado quando os preços mudarem ou os anúncios estiverem prestes a expirar",
    "seo": { "title": "Minha lista de favoritos - The Mini Exchange", "description": "Veja e gerencie seus anúncios Classic Mini salvos" }
  },
  "ru": {
    "header": { "title": "Мой список отслеживания", "savedCount": "{count} сохранённое объявление | {count} сохранённых объявлений" },
    "browse": "Смотреть объявления",
    "empty": { "title": "Пока нет сохранённых объявлений", "body": "Начните просматривать и сохраняйте интересные объявления" },
    "info": "Мы уведомим вас об изменении цен или скором истечении объявлений",
    "seo": { "title": "Мой список отслеживания - The Mini Exchange", "description": "Просматривайте и управляйте сохранёнными объявлениями Classic Mini" }
  },
  "ja": {
    "header": { "title": "ウォッチリスト", "savedCount": "保存した出品 {count} 件" },
    "browse": "出品を見る",
    "empty": { "title": "保存した出品はまだありません", "body": "気になる出品を探して保存しましょう" },
    "info": "価格の変更や出品の有効期限が近づくとお知らせします",
    "seo": { "title": "ウォッチリスト - The Mini Exchange", "description": "保存した Classic Mini の出品を表示・管理できます" }
  },
  "zh": {
    "header": { "title": "我的收藏", "savedCount": "已保存 {count} 个商品" },
    "browse": "浏览商品",
    "empty": { "title": "还没有收藏的商品", "body": "开始浏览并收藏你感兴趣的商品" },
    "info": "当价格变动或商品即将过期时，我们会通知你",
    "seo": { "title": "我的收藏 - The Mini Exchange", "description": "查看和管理你收藏的 Classic Mini 商品" }
  },
  "ko": {
    "header": { "title": "내 관심 목록", "savedCount": "저장한 매물 {count}개" },
    "browse": "매물 둘러보기",
    "empty": { "title": "아직 저장한 매물이 없습니다", "body": "둘러보면서 관심 있는 매물을 저장해 보세요" },
    "info": "가격이 변경되거나 매물이 곧 만료되면 알려드립니다",
    "seo": { "title": "내 관심 목록 - The Mini Exchange", "description": "저장한 Classic Mini 매물을 확인하고 관리하세요" }
  }
}
</i18n>
