<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="py-12">
      <div class="container">
        <div class="skeleton h-96 mb-6"></div>
        <div class="skeleton h-8 w-2/3 mb-4"></div>
        <div class="skeleton h-4 w-1/2 mb-2"></div>
        <div class="skeleton h-32"></div>
      </div>
    </div>

    <!-- Find Content -->
    <div v-else-if="currentFind">
      <!-- Hero Image -->
      <section class="bg-base-200">
        <div class="container">
          <div class="py-8 flex justify-center">
            <div class="bg-base-300 rounded-lg overflow-hidden max-h-125 max-w-3xl w-full">
              <img
                v-if="currentFind.og_image_url && !imageError"
                :src="currentFind.og_image_url"
                :alt="currentFind.title"
                class="w-full h-auto object-contain max-h-125 mx-auto"
                @error="imageError = true"
              />
              <div v-else class="aspect-video w-full flex items-center justify-center">
                <i class="fas fa-link text-7xl text-base-content/20"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Find Details -->
      <section class="py-12">
        <div class="container">
          <div class="grid lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-8 order-2 lg:order-1">
              <!-- Badges Row -->
              <div class="flex flex-wrap items-center gap-2">
                <ExchangeFindsSourceSiteBadge :site="currentFind.source_site" size="md" />
                <span v-if="currentFind.is_editors_pick" class="badge badge-accent gap-1">
                  <i class="fas fa-star"></i>
                  {{ t('editorsPick') }}
                </span>
                <span v-if="currentFind.category" class="badge badge-outline">
                  {{ formatCategory(currentFind.category) }}
                </span>
              </div>

              <!-- Title -->
              <h1 class="text-4xl font-bold">{{ currentFind.title }}</h1>

              <!-- Metadata Row -->
              <div class="flex flex-wrap items-center gap-4 text-base-content/70">
                <div v-if="currentFind.year" class="flex items-center gap-1.5">
                  <i class="fas fa-calendar"></i>
                  <span>{{ currentFind.year }}</span>
                </div>
                <div v-if="currentFind.model" class="flex items-center gap-1.5">
                  <i class="fas fa-truck"></i>
                  <span>{{ currentFind.model }}</span>
                </div>
                <div v-if="currentFind.price != null || currentFind.price_label" class="flex items-center gap-1.5">
                  <i class="fas fa-dollar-sign"></i>
                  <span class="font-semibold text-primary text-lg">
                    {{ currentFind.price_label || formatPrice(currentFind.price!) }}
                  </span>
                </div>
              </div>

              <!-- Auction Countdown -->
              <div v-if="auctionLabel" class="alert" :class="auctionEnded ? 'alert-info' : 'alert-warning'">
                <i :class="auctionEnded ? 'fas fa-clock' : 'fas fa-fire'"></i>
                <span class="font-medium">{{ auctionLabel }}</span>
              </div>

              <!-- Editor Commentary -->
              <div v-if="currentFind.editor_commentary" class="mt-8">
                <h2 class="text-xl font-semibold mb-3">{{ t('editorsCommentary') }}</h2>
                <blockquote class="border-l-4 border-primary pl-4 py-2 bg-base-200 rounded-r-lg">
                  <p class="text-base-content/80 whitespace-pre-wrap italic">{{ currentFind.editor_commentary }}</p>
                </blockquote>
              </div>

              <!-- User Description -->
              <div v-if="currentFind.description" class="mt-8">
                <h2 class="text-xl font-semibold mb-3">{{ t('aboutThisFind') }}</h2>
                <p class="text-base-content/80 whitespace-pre-wrap">{{ currentFind.description }}</p>
              </div>

              <!-- OG Description (fallback from source site) -->
              <div v-else-if="currentFind.og_description" class="mt-8">
                <h2 class="text-xl font-semibold mb-3">{{ t('fromTheSource') }}</h2>
                <p class="text-base-content/80 whitespace-pre-wrap">{{ currentFind.og_description }}</p>
              </div>

              <!-- Tags -->
              <div v-if="currentFind.tags && currentFind.tags.length > 0" class="flex flex-wrap gap-2">
                <span v-for="tag in currentFind.tags" :key="tag" class="badge badge-outline">
                  {{ tag }}
                </span>
              </div>

              <!-- Comments Section -->
              <div class="mt-8">
                <ExchangeListingsCommentSection :listing-id="currentFind.id" :external-listing-id="currentFind.id" />
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1 order-1 lg:order-2">
              <div class="lg:sticky lg:top-20 space-y-6">
                <!-- Action Card -->
                <div class="card bg-base-100 shadow-sm">
                  <div class="card-body">
                    <!-- Price / Auction Info -->
                    <div v-if="currentFind.price != null || currentFind.price_label" class="text-center mb-2">
                      <div class="text-2xl font-bold text-primary">
                        {{ currentFind.price_label || formatPrice(currentFind.price!) }}
                      </div>
                    </div>

                    <!-- View Original -->
                    <a
                      :href="currentFind.source_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-primary btn-block gap-2"
                      @click="trackSourceClick"
                    >
                      <i class="fas fa-arrow-up-right-from-square"></i>
                      {{ t('viewOnSource', { source: sourceSiteDisplayName }) }}
                    </a>

                    <!-- Like & Watchlist Row -->
                    <div class="flex gap-2 mt-2">
                      <ExchangeFindsLikeButton
                        :find-id="currentFind.id"
                        :like-count="currentFind.like_count"
                        :is-liked="isLiked(currentFind.id)"
                        class="flex-1 justify-center"
                        @toggle="toggleLike(currentFind.id)"
                      />
                      <ExchangeListingsWatchlistButton
                        :listing-id="currentFind.id"
                        :external-listing-id="currentFind.id"
                        class="flex-1"
                      />
                    </div>

                    <!-- Share Buttons -->
                    <div class="pt-4 border-t border-base-300 mt-2">
                      <ExchangeListingsShareButtons
                        :title="currentFind.title"
                        :url="currentUrl"
                        :description="currentFind.description || currentFind.og_description || ''"
                        :show-label="true"
                      />
                    </div>
                  </div>
                </div>

                <!-- Submitter Info -->
                <div class="card bg-base-100 shadow-sm">
                  <div class="card-body">
                    <div class="text-sm font-medium text-base-content/60 mb-3">{{ t('submittedBy') }}</div>
                    <div class="flex items-center gap-3">
                      <div class="avatar shrink-0">
                        <div class="w-10 h-10 rounded-full bg-base-300">
                          <img
                            v-if="currentFind.profiles?.avatar_url"
                            :src="currentFind.profiles.avatar_url"
                            :alt="currentFind.profiles.display_name || t('userAlt')"
                            loading="lazy"
                          />
                          <div
                            v-else
                            class="flex items-center justify-center h-full text-sm font-semibold text-base-content/70"
                          >
                            {{ getInitials(currentFind.profiles?.display_name || currentFind.profiles?.username || 'U') }}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div class="font-medium">
                          {{ currentFind.profiles?.display_name || currentFind.profiles?.username || t('communityMember') }}
                        </div>
                        <div class="text-sm text-base-content/60">
                          {{ formatDate(currentFind.created_at) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Not Found State -->
    <div v-else class="py-20">
      <div class="container">
        <div class="text-center">
          <i class="fas fa-triangle-exclamation text-6xl mb-4 text-base-content/30"></i>
          <h1 class="text-3xl font-bold mb-2">{{ t('notFoundTitle') }}</h1>
          <p class="text-base-content/70 mb-6">{{ t('notFoundBody') }}</p>
          <NuxtLink to="/exchange/finds" class="btn btn-primary btn-lg">{{ t('browseAllFinds') }}</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const route = useRoute();
  const config = useRuntimeConfig();
  const { user } = useAuth();
  const { capture } = usePostHog();
  const { currentFind, loading, fetchFind, toggleLike, isLiked, loadUserInteractions } = useExternalListings();

  const slug = route.params.slug as string;
  const imageError = ref(false);

  // Source site display names (used for "View on ..." button) — dynamic data, not translated
  const sourceSiteDisplayName = computed(() => {
    if (!currentFind.value) return 'Other';
    const map: Record<string, string> = {
      bat: 'Bring a Trailer',
      carsandbids: 'Cars & Bids',
      copart: 'Copart',
      craigslist: 'Craigslist',
      facebook: 'Facebook',
      ebay: 'eBay',
      other: 'Other',
    };
    return map[currentFind.value.source_site] || 'Other';
  });

  // Format price as currency
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format category display name
  const formatCategory = (category: string): string => {
    const map: Record<string, string> = {
      vehicle: t('categoryVehicle'),
      engine: t('categoryEngine'),
      parts: t('categoryParts'),
    };
    return map[category] || category;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get initials from a name
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Current page URL for sharing
  const currentUrl = computed(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return `${config.public.siteUrl || 'https://www.classicminidiy.com'}/exchange/finds/${slug}`;
  });

  // Don't show auction countdown if the listing is already sold
  const isSold = computed(() => {
    return currentFind.value?.price_label ? /sold/i.test(currentFind.value.price_label) : false;
  });

  // Auction countdown logic
  const auctionEnded = computed(() => {
    if (!currentFind.value?.auction_end_time || isSold.value) return false;
    return new Date(currentFind.value.auction_end_time) <= new Date();
  });

  const auctionLabel = computed(() => {
    if (!currentFind.value?.auction_end_time || isSold.value) return null;

    const endTime = new Date(currentFind.value.auction_end_time);
    const now = new Date();

    if (endTime <= now) {
      return t('auctionEnded');
    }

    const diffMs = endTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;

    if (diffDays > 0) {
      return t('auctionEndsInDays', { days: diffDays, hours: remainingHours });
    }
    return t('auctionEndsInHours', { hours: diffHours, minutes: diffMinutes });
  });

  // Track click to source listing
  const trackSourceClick = () => {
    if (!currentFind.value) return;
    capture('find_clicked_source', {
      id: currentFind.value.id,
      source_site: currentFind.value.source_site,
      source_url: currentFind.value.source_url,
    });
  };

  // SEO metadata (reactive based on loaded find)
  const siteUrl = config.public.siteUrl || 'https://www.classicminidiy.com';

  useSeoMeta({
    title: () =>
      currentFind.value ? `${currentFind.value.title} | ${t('seoSuffix')}` : t('seoFallbackTitle'),
    description: () =>
      currentFind.value?.description ||
      currentFind.value?.og_description ||
      t('seoDescription'),
    ogTitle: () => currentFind.value?.title || t('seoOgTitle'),
    ogDescription: () =>
      currentFind.value?.description || currentFind.value?.og_description || t('seoOgDescription'),
    ogType: 'article',
    ogUrl: `${siteUrl}/exchange/finds/${slug}`,
    ogImage: () => currentFind.value?.og_image_url || `${siteUrl}/og-image.jpg`,
    ogSiteName: 'Classic Mini DIY',
    twitterCard: 'summary_large_image',
    twitterTitle: () => currentFind.value?.title || t('seoOgTitle'),
    twitterDescription: () =>
      currentFind.value?.description || currentFind.value?.og_description || t('seoOgDescription'),
    twitterImage: () => currentFind.value?.og_image_url || `${siteUrl}/og-image.jpg`,
  });

  // Track view on mount
  const hasTrackedView = ref(false);

  watch(
    () => currentFind.value,
    (find) => {
      if (find && !hasTrackedView.value && import.meta.client) {
        hasTrackedView.value = true;
        capture('find_viewed', {
          id: find.id,
          source_site: find.source_site,
          is_editors_pick: find.is_editors_pick,
        });
      }
    },
    { immediate: true }
  );

  // Fetch find on mount
  onMounted(async () => {
    await fetchFind(slug);

    if (user.value) {
      loadUserInteractions();
    }
  });
</script>

<i18n lang="json">
{
  "en": {
    "editorsPick": "Editor's Pick",
    "editorsCommentary": "Editor's Commentary",
    "aboutThisFind": "About This Find",
    "fromTheSource": "From the Source",
    "viewOnSource": "View on {source}",
    "submittedBy": "Submitted by",
    "communityMember": "Community Member",
    "userAlt": "User",
    "auctionEnded": "Auction Ended",
    "auctionEndsInDays": "Auction ends in {days}d {hours}h",
    "auctionEndsInHours": "Auction ends in {hours}h {minutes}m",
    "categoryVehicle": "Vehicle",
    "categoryEngine": "Engine",
    "categoryParts": "Parts",
    "notFoundTitle": "Find Not Found",
    "notFoundBody": "The find you are looking for does not exist or has been removed.",
    "browseAllFinds": "Browse All Finds",
    "seoSuffix": "Mini Finds | Classic Mini DIY",
    "seoFallbackTitle": "Find | Classic Mini DIY",
    "seoDescription": "A Classic Mini listing found on the web by the community.",
    "seoOgTitle": "Mini Find",
    "seoOgDescription": "A Classic Mini listing found on the web."
  },
  "es": {
    "editorsPick": "Selección del editor",
    "editorsCommentary": "Comentario del editor",
    "aboutThisFind": "Sobre este hallazgo",
    "fromTheSource": "Desde la fuente",
    "viewOnSource": "Ver en {source}",
    "submittedBy": "Enviado por",
    "communityMember": "Miembro de la comunidad",
    "userAlt": "Usuario",
    "auctionEnded": "Subasta finalizada",
    "auctionEndsInDays": "La subasta termina en {days}d {hours}h",
    "auctionEndsInHours": "La subasta termina en {hours}h {minutes}m",
    "categoryVehicle": "Vehículo",
    "categoryEngine": "Motor",
    "categoryParts": "Piezas",
    "notFoundTitle": "Hallazgo no encontrado",
    "notFoundBody": "El hallazgo que buscas no existe o ha sido eliminado.",
    "browseAllFinds": "Explorar todos los hallazgos",
    "seoSuffix": "Hallazgos Mini | Classic Mini DIY",
    "seoFallbackTitle": "Hallazgo | Classic Mini DIY",
    "seoDescription": "Un anuncio de Classic Mini encontrado en la web por la comunidad.",
    "seoOgTitle": "Hallazgo Mini",
    "seoOgDescription": "Un anuncio de Classic Mini encontrado en la web."
  },
  "fr": {
    "editorsPick": "Choix de la rédaction",
    "editorsCommentary": "Commentaire de la rédaction",
    "aboutThisFind": "À propos de cette trouvaille",
    "fromTheSource": "Depuis la source",
    "viewOnSource": "Voir sur {source}",
    "submittedBy": "Soumis par",
    "communityMember": "Membre de la communauté",
    "userAlt": "Utilisateur",
    "auctionEnded": "Enchère terminée",
    "auctionEndsInDays": "L'enchère se termine dans {days}j {hours}h",
    "auctionEndsInHours": "L'enchère se termine dans {hours}h {minutes}m",
    "categoryVehicle": "Véhicule",
    "categoryEngine": "Moteur",
    "categoryParts": "Pièces",
    "notFoundTitle": "Trouvaille introuvable",
    "notFoundBody": "La trouvaille que vous recherchez n'existe pas ou a été supprimée.",
    "browseAllFinds": "Parcourir toutes les trouvailles",
    "seoSuffix": "Trouvailles Mini | Classic Mini DIY",
    "seoFallbackTitle": "Trouvaille | Classic Mini DIY",
    "seoDescription": "Une annonce Classic Mini trouvée sur le web par la communauté.",
    "seoOgTitle": "Trouvaille Mini",
    "seoOgDescription": "Une annonce Classic Mini trouvée sur le web."
  },
  "de": {
    "editorsPick": "Empfehlung der Redaktion",
    "editorsCommentary": "Kommentar der Redaktion",
    "aboutThisFind": "Über diesen Fund",
    "fromTheSource": "Von der Quelle",
    "viewOnSource": "Auf {source} ansehen",
    "submittedBy": "Eingereicht von",
    "communityMember": "Community-Mitglied",
    "userAlt": "Benutzer",
    "auctionEnded": "Auktion beendet",
    "auctionEndsInDays": "Auktion endet in {days}T {hours}Std",
    "auctionEndsInHours": "Auktion endet in {hours}Std {minutes}Min",
    "categoryVehicle": "Fahrzeug",
    "categoryEngine": "Motor",
    "categoryParts": "Teile",
    "notFoundTitle": "Fund nicht gefunden",
    "notFoundBody": "Der gesuchte Fund existiert nicht oder wurde entfernt.",
    "browseAllFinds": "Alle Funde durchsuchen",
    "seoSuffix": "Mini-Funde | Classic Mini DIY",
    "seoFallbackTitle": "Fund | Classic Mini DIY",
    "seoDescription": "Ein Classic-Mini-Inserat, das die Community im Web gefunden hat.",
    "seoOgTitle": "Mini-Fund",
    "seoOgDescription": "Ein Classic-Mini-Inserat, im Web gefunden."
  },
  "it": {
    "editorsPick": "Scelta della redazione",
    "editorsCommentary": "Commento della redazione",
    "aboutThisFind": "Informazioni su questa scoperta",
    "fromTheSource": "Dalla fonte",
    "viewOnSource": "Vedi su {source}",
    "submittedBy": "Inviato da",
    "communityMember": "Membro della community",
    "userAlt": "Utente",
    "auctionEnded": "Asta terminata",
    "auctionEndsInDays": "L'asta termina tra {days}g {hours}h",
    "auctionEndsInHours": "L'asta termina tra {hours}h {minutes}m",
    "categoryVehicle": "Veicolo",
    "categoryEngine": "Motore",
    "categoryParts": "Ricambi",
    "notFoundTitle": "Scoperta non trovata",
    "notFoundBody": "La scoperta che stai cercando non esiste o è stata rimossa.",
    "browseAllFinds": "Sfoglia tutte le scoperte",
    "seoSuffix": "Scoperte Mini | Classic Mini DIY",
    "seoFallbackTitle": "Scoperta | Classic Mini DIY",
    "seoDescription": "Un annuncio di Classic Mini trovato sul web dalla community.",
    "seoOgTitle": "Scoperta Mini",
    "seoOgDescription": "Un annuncio di Classic Mini trovato sul web."
  },
  "pt": {
    "editorsPick": "Escolha do editor",
    "editorsCommentary": "Comentário do editor",
    "aboutThisFind": "Sobre este achado",
    "fromTheSource": "Da fonte",
    "viewOnSource": "Ver em {source}",
    "submittedBy": "Enviado por",
    "communityMember": "Membro da comunidade",
    "userAlt": "Usuário",
    "auctionEnded": "Leilão encerrado",
    "auctionEndsInDays": "O leilão termina em {days}d {hours}h",
    "auctionEndsInHours": "O leilão termina em {hours}h {minutes}m",
    "categoryVehicle": "Veículo",
    "categoryEngine": "Motor",
    "categoryParts": "Peças",
    "notFoundTitle": "Achado não encontrado",
    "notFoundBody": "O achado que você procura não existe ou foi removido.",
    "browseAllFinds": "Ver todos os achados",
    "seoSuffix": "Achados Mini | Classic Mini DIY",
    "seoFallbackTitle": "Achado | Classic Mini DIY",
    "seoDescription": "Um anúncio de Classic Mini encontrado na web pela comunidade.",
    "seoOgTitle": "Achado Mini",
    "seoOgDescription": "Um anúncio de Classic Mini encontrado na web."
  },
  "ru": {
    "editorsPick": "Выбор редакции",
    "editorsCommentary": "Комментарий редакции",
    "aboutThisFind": "Об этой находке",
    "fromTheSource": "Из источника",
    "viewOnSource": "Открыть на {source}",
    "submittedBy": "Добавил",
    "communityMember": "Участник сообщества",
    "userAlt": "Пользователь",
    "auctionEnded": "Аукцион завершён",
    "auctionEndsInDays": "Аукцион завершится через {days}д {hours}ч",
    "auctionEndsInHours": "Аукцион завершится через {hours}ч {minutes}м",
    "categoryVehicle": "Автомобиль",
    "categoryEngine": "Двигатель",
    "categoryParts": "Запчасти",
    "notFoundTitle": "Находка не найдена",
    "notFoundBody": "Находка, которую вы ищете, не существует или была удалена.",
    "browseAllFinds": "Все находки",
    "seoSuffix": "Находки Mini | Classic Mini DIY",
    "seoFallbackTitle": "Находка | Classic Mini DIY",
    "seoDescription": "Объявление о Classic Mini, найденное в сети участниками сообщества.",
    "seoOgTitle": "Находка Mini",
    "seoOgDescription": "Объявление о Classic Mini, найденное в сети."
  },
  "ja": {
    "editorsPick": "編集者のおすすめ",
    "editorsCommentary": "編集者のコメント",
    "aboutThisFind": "この発見について",
    "fromTheSource": "出典元より",
    "viewOnSource": "{source} で見る",
    "submittedBy": "投稿者",
    "communityMember": "コミュニティメンバー",
    "userAlt": "ユーザー",
    "auctionEnded": "オークション終了",
    "auctionEndsInDays": "オークション終了まで {days}日 {hours}時間",
    "auctionEndsInHours": "オークション終了まで {hours}時間 {minutes}分",
    "categoryVehicle": "車両",
    "categoryEngine": "エンジン",
    "categoryParts": "パーツ",
    "notFoundTitle": "発見が見つかりません",
    "notFoundBody": "お探しの発見は存在しないか、削除されました。",
    "browseAllFinds": "すべての発見を見る",
    "seoSuffix": "Mini ファインド | Classic Mini DIY",
    "seoFallbackTitle": "ファインド | Classic Mini DIY",
    "seoDescription": "コミュニティがウェブ上で見つけた Classic Mini の出品です。",
    "seoOgTitle": "Mini ファインド",
    "seoOgDescription": "ウェブ上で見つかった Classic Mini の出品です。"
  },
  "zh": {
    "editorsPick": "编辑精选",
    "editorsCommentary": "编辑点评",
    "aboutThisFind": "关于此发现",
    "fromTheSource": "来自来源",
    "viewOnSource": "在 {source} 上查看",
    "submittedBy": "提交者",
    "communityMember": "社区成员",
    "userAlt": "用户",
    "auctionEnded": "拍卖已结束",
    "auctionEndsInDays": "拍卖将在 {days}天 {hours}小时 后结束",
    "auctionEndsInHours": "拍卖将在 {hours}小时 {minutes}分钟 后结束",
    "categoryVehicle": "车辆",
    "categoryEngine": "发动机",
    "categoryParts": "零件",
    "notFoundTitle": "未找到该发现",
    "notFoundBody": "您查找的发现不存在或已被删除。",
    "browseAllFinds": "浏览所有发现",
    "seoSuffix": "Mini 发现 | Classic Mini DIY",
    "seoFallbackTitle": "发现 | Classic Mini DIY",
    "seoDescription": "社区在网络上发现的 Classic Mini 刊登。",
    "seoOgTitle": "Mini 发现",
    "seoOgDescription": "在网络上发现的 Classic Mini 刊登。"
  },
  "ko": {
    "editorsPick": "에디터 추천",
    "editorsCommentary": "에디터 코멘트",
    "aboutThisFind": "이 발견에 대하여",
    "fromTheSource": "출처에서",
    "viewOnSource": "{source}에서 보기",
    "submittedBy": "제출자",
    "communityMember": "커뮤니티 회원",
    "userAlt": "사용자",
    "auctionEnded": "경매 종료",
    "auctionEndsInDays": "경매가 {days}일 {hours}시간 후 종료됩니다",
    "auctionEndsInHours": "경매가 {hours}시간 {minutes}분 후 종료됩니다",
    "categoryVehicle": "차량",
    "categoryEngine": "엔진",
    "categoryParts": "부품",
    "notFoundTitle": "발견을 찾을 수 없습니다",
    "notFoundBody": "찾고 있는 발견이 존재하지 않거나 삭제되었습니다.",
    "browseAllFinds": "모든 발견 보기",
    "seoSuffix": "Mini 발견 | Classic Mini DIY",
    "seoFallbackTitle": "발견 | Classic Mini DIY",
    "seoDescription": "커뮤니티가 웹에서 발견한 Classic Mini 매물입니다.",
    "seoOgTitle": "Mini 발견",
    "seoOgDescription": "웹에서 발견한 Classic Mini 매물입니다."
  }
}
</i18n>
