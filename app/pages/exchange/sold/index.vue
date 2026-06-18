<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-4xl font-bold mb-2">{{ t('header.title') }}</h1>
            <p class="text-base-content/70">
              {{ t('header.subtitle', { count: totalCount }) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Search Bar -->
    <section class="bg-base-200 py-6 border-b border-base-300">
      <div class="container">
        <ExchangeListingsSearchBar v-model="searchQuery" :placeholder="t('search.placeholder')" />
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <!-- Listings Grid -->
        <div>
          <!-- Results Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <p class="text-base-content/70">
                <span v-if="loading">{{ t('results.searching') }}</span>
                <span v-else-if="totalCount > 0">
                  {{ t('results.showing', { shown: listings.length, total: totalCount }) }}
                </span>
                <span v-else>{{ t('results.none') }}</span>
              </p>
            </div>

            <select v-model="sortBy" class="select select-sm w-auto" :aria-label="t('sort.ariaLabel')">
              <option value="newest">{{ t('sort.newest') }}</option>
              <option value="oldest">{{ t('sort.oldest') }}</option>
              <option value="price_desc">{{ t('sort.priceDesc') }}</option>
              <option value="price_asc">{{ t('sort.priceAsc') }}</option>
            </select>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <div v-for="i in 6" :key="i" class="skeleton h-80 w-full"></div>
          </div>

          <!-- Sold Listings Grid -->
          <div v-else-if="listings.length > 0" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <NuxtLink
              v-for="listing in listings"
              :key="listing.id"
              :to="`/exchange/listings/${listing.slug}`"
              class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <figure class="h-56 bg-base-300 relative">
                <img
                  v-if="getPrimaryPhoto(listing)"
                  :src="getPrimaryPhoto(listing)"
                  :alt="listing.title"
                  class="w-full h-full object-contain"
                  style="object-fit: contain"
                  loading="lazy"
                />
                <div v-else class="flex items-center justify-center w-full h-full">
                  <i class="fas fa-image text-5xl text-base-content/30"></i>
                </div>
                <div class="absolute top-3 right-3">
                  <div class="badge badge-neutral">{{ t('badge.sold') }}</div>
                </div>
              </figure>

              <div class="card-body">
                <h3 class="card-title text-base">{{ listing.year }} {{ listing.model }}</h3>
                <p class="text-sm text-base-content/70 line-clamp-1">{{ listing.title }}</p>

                <div class="mt-2">
                  <div class="text-lg font-bold text-success">
                    {{
                      formatListingPrice(
                        getSoldPrice(listing),
                        formatCurrency(getSoldPrice(listing), getListingCurrency(listing))
                      )
                    }}
                  </div>
                  <div
                    v-if="getConvertedPrice(listing) && getSoldPrice(listing) !== 0"
                    class="text-xs text-base-content/60"
                  >
                    {{ t('price.about', { amount: formatCurrency(getConvertedPrice(listing)!, userCurrency), currency: userCurrency }) }}
                  </div>
                  <div class="text-xs text-base-content/60">{{ t('price.soldOn', { date: formatSoldDate(listing.sold_date) }) }}</div>
                </div>

                <div v-if="displayLocation(listing)" class="mt-2">
                  <div class="flex items-center gap-1 text-xs text-base-content/60">
                    <template v-if="getCountryFlag(listing.country)">{{ getCountryFlag(listing.country) }}</template>
                    <i v-else class="fas fa-location-dot"></i>
                    <span>{{ displayLocation(listing) }}</span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-16">
            <i class="fas fa-box-archive text-5xl mx-auto mb-4 text-base-content/30"></i>
            <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
            <p class="text-base-content/70 mb-6">{{ t('empty.body') }}</p>
            <button v-if="searchQuery" class="btn btn-outline" @click="clearFilters">{{ t('empty.clear') }}</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import type { CurrencyCode } from '~/composables/useCurrency';
  import { getCountryFlag } from '~/utils/countryFlags';

  const { t } = useI18n();

  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.description'),
    robots: 'noindex, follow',
  });

  useHead({
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/exchange/sold' }],
  });

  const supabase = useSupabase();
  const { user } = useAuth();
  const { getPhotoUrl } = useListings();
  const { formatCurrency, convertCurrency, fetchExchangeRates, exchangeRates } = useCurrency();
  const { fetchProfile } = useProfile();

  const { userCurrency } = useCurrency();

  // Get listing currency
  const getListingCurrency = (listing: ListingWithPhotos): CurrencyCode => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((listing as any).currency as CurrencyCode) || 'USD';
  };

  // Get sold/final price for a listing
  const getSoldPrice = (listing: ListingWithPhotos): number | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalPrice = (listing as any).final_price;
    if (finalPrice) return finalPrice;
    return listing.price;
  };

  // Get converted price for a listing
  const getConvertedPrice = (listing: ListingWithPhotos): number | null => {
    const listingCurrency = getListingCurrency(listing);
    if (!exchangeRates.value) return null;
    if (listingCurrency === userCurrency.value) return null;

    const price = getSoldPrice(listing);
    if (!price) return null;
    return convertCurrency(price, listingCurrency, userCurrency.value);
  };

  const { formatDisplayLocation, formatListingPrice } = useFormatters();

  const displayLocation = (listing: ListingWithPhotos): string => {
    return formatDisplayLocation(listing);
  };

  const searchQuery = ref('');
  const sortBy = ref('newest');

  const listings = ref<ListingWithPhotos[]>([]);
  const loading = ref(false);
  const totalCount = ref(0);

  const formatSoldDate = (dateString: string | null): string => {
    if (!dateString) return t('date.unknown');
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('date.today');
    if (diffDays === 1) return t('date.yesterday');
    if (diffDays < 7) return t('date.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('date.weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('date.monthsAgo', { count: Math.floor(diffDays / 30) });

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const getPrimaryPhoto = (listing: ListingWithPhotos): string | null => {
    if (!listing.listing_photos || listing.listing_photos.length === 0) {
      return null;
    }

    const primaryPhoto = listing.listing_photos.find((photo) => photo.is_primary);
    const photo = primaryPhoto || listing.listing_photos[0];

    return photo ? getPhotoUrl(photo.storage_path) : null;
  };

  const performSearch = async () => {
    loading.value = true;

    try {
      let query = supabase
        .from('listings')
        .select(
          `
          *,
          listing_photos (
            id,
            storage_path,
            display_order,
            category,
            is_primary
          ),
          profiles:public_profiles!listings_user_id_fkey (
            id,
            display_name,
            username,
            location
          )
        `,
          { count: 'exact' }
        )
        // Include sold listings only
        .eq('status', 'sold');

      // Apply search filter
      if (searchQuery.value) {
        query = query.textSearch('search_vector', searchQuery.value);
      }

      // Apply sorting
      switch (sortBy.value) {
        case 'oldest':
          query = query.order('sold_date', { ascending: true, nullsLast: true });
          break;
        case 'price_asc':
          query = query.order('final_price', { ascending: true, nullsFirst: false });
          break;
        case 'price_desc':
          query = query.order('final_price', { ascending: false, nullsFirst: false });
          break;
        case 'newest':
        default:
          query = query.order('sold_date', { ascending: false, nullsLast: true });
          break;
      }

      query = applyPhotoOrdering(query);

      const { data, error, count } = await query;

      if (error) {
        console.error('Search error:', error);
        throw error;
      }

      listings.value = (data as ListingWithPhotos[]) || [];
      totalCount.value = count || 0;
    } catch (error) {
      console.error('Failed to search sold listings:', error);
      listings.value = [];
      totalCount.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const clearFilters = () => {
    searchQuery.value = '';
    sortBy.value = 'newest';
  };

  // Watch search and sort
  watch([searchQuery, sortBy], () => {
    performSearch();
  });

  // Initial load
  onMounted(() => {
    performSearch();
    fetchExchangeRates();
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "Sold Listings Archive - The Mini Exchange", "description": "Browse previously sold Classic Mini listings. Research past prices for vehicles, engines, and parts." },
    "header": { "title": "Sold Listings Archive", "subtitle": "Browse {count} sold listings for market research" },
    "search": { "placeholder": "Search sold listings..." },
    "results": { "searching": "Searching...", "showing": "Showing {shown} of {total} sold listings", "none": "No sold listings found" },
    "sort": { "ariaLabel": "Sort sold listings", "newest": "Recently Sold", "oldest": "Oldest First", "priceDesc": "Highest Price", "priceAsc": "Lowest Price" },
    "badge": { "sold": "SOLD" },
    "price": { "about": "About {amount} in {currency}", "soldOn": "Sold {date}" },
    "empty": { "title": "No Sold Listings Found", "body": "Try adjusting your search to see more results.", "clear": "Clear Search" },
    "date": { "unknown": "Unknown date", "today": "Today", "yesterday": "Yesterday", "daysAgo": "{count} days ago", "weeksAgo": "{count} weeks ago", "monthsAgo": "{count} months ago" }
  },
  "es": {
    "seo": { "title": "Archivo de anuncios vendidos - The Mini Exchange", "description": "Explora anuncios de Classic Mini vendidos anteriormente. Investiga precios pasados de vehículos, motores y piezas." },
    "header": { "title": "Archivo de anuncios vendidos", "subtitle": "Explora {count} anuncios vendidos para estudios de mercado" },
    "search": { "placeholder": "Buscar anuncios vendidos..." },
    "results": { "searching": "Buscando...", "showing": "Mostrando {shown} de {total} anuncios vendidos", "none": "No se encontraron anuncios vendidos" },
    "sort": { "ariaLabel": "Ordenar anuncios vendidos", "newest": "Vendidos recientemente", "oldest": "Más antiguos primero", "priceDesc": "Precio más alto", "priceAsc": "Precio más bajo" },
    "badge": { "sold": "VENDIDO" },
    "price": { "about": "Aproximadamente {amount} en {currency}", "soldOn": "Vendido {date}" },
    "empty": { "title": "No se encontraron anuncios vendidos", "body": "Intenta ajustar tu búsqueda para ver más resultados.", "clear": "Borrar búsqueda" },
    "date": { "unknown": "Fecha desconocida", "today": "Hoy", "yesterday": "Ayer", "daysAgo": "hace {count} días", "weeksAgo": "hace {count} semanas", "monthsAgo": "hace {count} meses" }
  },
  "fr": {
    "seo": { "title": "Archive des annonces vendues - The Mini Exchange", "description": "Parcourez les annonces de Classic Mini déjà vendues. Recherchez les prix passés des véhicules, moteurs et pièces." },
    "header": { "title": "Archive des annonces vendues", "subtitle": "Parcourez {count} annonces vendues pour vos études de marché" },
    "search": { "placeholder": "Rechercher des annonces vendues..." },
    "results": { "searching": "Recherche...", "showing": "Affichage de {shown} sur {total} annonces vendues", "none": "Aucune annonce vendue trouvée" },
    "sort": { "ariaLabel": "Trier les annonces vendues", "newest": "Vendues récemment", "oldest": "Les plus anciennes d'abord", "priceDesc": "Prix le plus élevé", "priceAsc": "Prix le plus bas" },
    "badge": { "sold": "VENDU" },
    "price": { "about": "Environ {amount} en {currency}", "soldOn": "Vendu {date}" },
    "empty": { "title": "Aucune annonce vendue trouvée", "body": "Essayez d'ajuster votre recherche pour voir plus de résultats.", "clear": "Effacer la recherche" },
    "date": { "unknown": "Date inconnue", "today": "Aujourd'hui", "yesterday": "Hier", "daysAgo": "il y a {count} jours", "weeksAgo": "il y a {count} semaines", "monthsAgo": "il y a {count} mois" }
  },
  "de": {
    "seo": { "title": "Archiv verkaufter Anzeigen - The Mini Exchange", "description": "Durchsuche zuvor verkaufte Classic-Mini-Anzeigen. Recherchiere frühere Preise für Fahrzeuge, Motoren und Teile." },
    "header": { "title": "Archiv verkaufter Anzeigen", "subtitle": "Durchsuche {count} verkaufte Anzeigen für die Marktforschung" },
    "search": { "placeholder": "Verkaufte Anzeigen suchen..." },
    "results": { "searching": "Suche läuft...", "showing": "Zeige {shown} von {total} verkauften Anzeigen", "none": "Keine verkauften Anzeigen gefunden" },
    "sort": { "ariaLabel": "Verkaufte Anzeigen sortieren", "newest": "Kürzlich verkauft", "oldest": "Älteste zuerst", "priceDesc": "Höchster Preis", "priceAsc": "Niedrigster Preis" },
    "badge": { "sold": "VERKAUFT" },
    "price": { "about": "Etwa {amount} in {currency}", "soldOn": "Verkauft {date}" },
    "empty": { "title": "Keine verkauften Anzeigen gefunden", "body": "Passe deine Suche an, um mehr Ergebnisse zu sehen.", "clear": "Suche zurücksetzen" },
    "date": { "unknown": "Unbekanntes Datum", "today": "Heute", "yesterday": "Gestern", "daysAgo": "vor {count} Tagen", "weeksAgo": "vor {count} Wochen", "monthsAgo": "vor {count} Monaten" }
  },
  "it": {
    "seo": { "title": "Archivio annunci venduti - The Mini Exchange", "description": "Sfoglia gli annunci di Classic Mini venduti in precedenza. Ricerca i prezzi passati di veicoli, motori e ricambi." },
    "header": { "title": "Archivio annunci venduti", "subtitle": "Sfoglia {count} annunci venduti per ricerche di mercato" },
    "search": { "placeholder": "Cerca annunci venduti..." },
    "results": { "searching": "Ricerca in corso...", "showing": "Mostrando {shown} di {total} annunci venduti", "none": "Nessun annuncio venduto trovato" },
    "sort": { "ariaLabel": "Ordina annunci venduti", "newest": "Venduti di recente", "oldest": "Prima i più vecchi", "priceDesc": "Prezzo più alto", "priceAsc": "Prezzo più basso" },
    "badge": { "sold": "VENDUTO" },
    "price": { "about": "Circa {amount} in {currency}", "soldOn": "Venduto {date}" },
    "empty": { "title": "Nessun annuncio venduto trovato", "body": "Prova a modificare la ricerca per vedere più risultati.", "clear": "Cancella ricerca" },
    "date": { "unknown": "Data sconosciuta", "today": "Oggi", "yesterday": "Ieri", "daysAgo": "{count} giorni fa", "weeksAgo": "{count} settimane fa", "monthsAgo": "{count} mesi fa" }
  },
  "pt": {
    "seo": { "title": "Arquivo de anúncios vendidos - The Mini Exchange", "description": "Navegue por anúncios de Classic Mini vendidos anteriormente. Pesquise preços passados de veículos, motores e peças." },
    "header": { "title": "Arquivo de anúncios vendidos", "subtitle": "Navegue por {count} anúncios vendidos para pesquisa de mercado" },
    "search": { "placeholder": "Pesquisar anúncios vendidos..." },
    "results": { "searching": "Pesquisando...", "showing": "Mostrando {shown} de {total} anúncios vendidos", "none": "Nenhum anúncio vendido encontrado" },
    "sort": { "ariaLabel": "Ordenar anúncios vendidos", "newest": "Vendidos recentemente", "oldest": "Mais antigos primeiro", "priceDesc": "Maior preço", "priceAsc": "Menor preço" },
    "badge": { "sold": "VENDIDO" },
    "price": { "about": "Cerca de {amount} em {currency}", "soldOn": "Vendido {date}" },
    "empty": { "title": "Nenhum anúncio vendido encontrado", "body": "Tente ajustar sua pesquisa para ver mais resultados.", "clear": "Limpar pesquisa" },
    "date": { "unknown": "Data desconhecida", "today": "Hoje", "yesterday": "Ontem", "daysAgo": "há {count} dias", "weeksAgo": "há {count} semanas", "monthsAgo": "há {count} meses" }
  },
  "ru": {
    "seo": { "title": "Архив проданных объявлений - The Mini Exchange", "description": "Просматривайте ранее проданные объявления Classic Mini. Изучайте прошлые цены на автомобили, двигатели и запчасти." },
    "header": { "title": "Архив проданных объявлений", "subtitle": "Просмотрите {count} проданных объявлений для анализа рынка" },
    "search": { "placeholder": "Поиск проданных объявлений..." },
    "results": { "searching": "Поиск...", "showing": "Показано {shown} из {total} проданных объявлений", "none": "Проданные объявления не найдены" },
    "sort": { "ariaLabel": "Сортировать проданные объявления", "newest": "Недавно проданные", "oldest": "Сначала старые", "priceDesc": "Сначала дорогие", "priceAsc": "Сначала дешёвые" },
    "badge": { "sold": "ПРОДАНО" },
    "price": { "about": "Около {amount} в {currency}", "soldOn": "Продано {date}" },
    "empty": { "title": "Проданные объявления не найдены", "body": "Попробуйте изменить запрос, чтобы увидеть больше результатов.", "clear": "Очистить поиск" },
    "date": { "unknown": "Дата неизвестна", "today": "Сегодня", "yesterday": "Вчера", "daysAgo": "{count} дн. назад", "weeksAgo": "{count} нед. назад", "monthsAgo": "{count} мес. назад" }
  },
  "ja": {
    "seo": { "title": "売却済み出品アーカイブ - The Mini Exchange", "description": "過去に売却されたクラシックミニの出品を閲覧。車両、エンジン、パーツの過去価格を調べられます。" },
    "header": { "title": "売却済み出品アーカイブ", "subtitle": "市場調査向けに {count} 件の売却済み出品を閲覧" },
    "search": { "placeholder": "売却済み出品を検索..." },
    "results": { "searching": "検索中...", "showing": "{total} 件中 {shown} 件の売却済み出品を表示", "none": "売却済み出品が見つかりません" },
    "sort": { "ariaLabel": "売却済み出品を並べ替え", "newest": "最近売却", "oldest": "古い順", "priceDesc": "価格が高い順", "priceAsc": "価格が安い順" },
    "badge": { "sold": "売却済み" },
    "price": { "about": "約 {amount}（{currency}）", "soldOn": "{date} に売却" },
    "empty": { "title": "売却済み出品が見つかりません", "body": "検索条件を変更すると、より多くの結果が表示されます。", "clear": "検索をクリア" },
    "date": { "unknown": "日付不明", "today": "今日", "yesterday": "昨日", "daysAgo": "{count} 日前", "weeksAgo": "{count} 週間前", "monthsAgo": "{count} か月前" }
  },
  "zh": {
    "seo": { "title": "已售刊登存档 - The Mini Exchange", "description": "浏览以往售出的经典 Mini 刊登。研究车辆、发动机和零件的历史价格。" },
    "header": { "title": "已售刊登存档", "subtitle": "浏览 {count} 条已售刊登用于市场调研" },
    "search": { "placeholder": "搜索已售刊登..." },
    "results": { "searching": "搜索中...", "showing": "显示 {total} 条已售刊登中的 {shown} 条", "none": "未找到已售刊登" },
    "sort": { "ariaLabel": "排序已售刊登", "newest": "最近售出", "oldest": "最早优先", "priceDesc": "价格从高到低", "priceAsc": "价格从低到高" },
    "badge": { "sold": "已售" },
    "price": { "about": "约 {amount}（{currency}）", "soldOn": "售于 {date}" },
    "empty": { "title": "未找到已售刊登", "body": "尝试调整搜索条件以查看更多结果。", "clear": "清除搜索" },
    "date": { "unknown": "日期未知", "today": "今天", "yesterday": "昨天", "daysAgo": "{count} 天前", "weeksAgo": "{count} 周前", "monthsAgo": "{count} 个月前" }
  },
  "ko": {
    "seo": { "title": "판매 완료 매물 아카이브 - The Mini Exchange", "description": "이전에 판매된 클래식 미니 매물을 둘러보세요. 차량, 엔진, 부품의 과거 가격을 조사할 수 있습니다." },
    "header": { "title": "판매 완료 매물 아카이브", "subtitle": "시장 조사를 위해 {count}개의 판매 완료 매물 둘러보기" },
    "search": { "placeholder": "판매 완료 매물 검색..." },
    "results": { "searching": "검색 중...", "showing": "판매 완료 매물 {total}개 중 {shown}개 표시", "none": "판매 완료 매물을 찾을 수 없습니다" },
    "sort": { "ariaLabel": "판매 완료 매물 정렬", "newest": "최근 판매순", "oldest": "오래된 순", "priceDesc": "높은 가격순", "priceAsc": "낮은 가격순" },
    "badge": { "sold": "판매됨" },
    "price": { "about": "약 {amount} ({currency})", "soldOn": "{date} 판매" },
    "empty": { "title": "판매 완료 매물을 찾을 수 없습니다", "body": "검색 조건을 조정하면 더 많은 결과를 볼 수 있습니다.", "clear": "검색 지우기" },
    "date": { "unknown": "날짜 불명", "today": "오늘", "yesterday": "어제", "daysAgo": "{count}일 전", "weeksAgo": "{count}주 전", "monthsAgo": "{count}개월 전" }
  }
}
</i18n>
