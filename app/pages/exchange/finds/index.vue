<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <h1 class="text-4xl font-bold mb-3">{{ t('hero.title') }}</h1>
        <p class="text-base-content/70 max-w-2xl text-lg leading-relaxed">
          {{ t('hero.intro') }}
          <span v-if="!loading && totalCount > 0" class="whitespace-nowrap">
            {{ t('hero.count', totalCount, { count: totalCount }) }}
          </span>
        </p>
      </div>
    </section>

    <!-- Filters -->
    <section class="bg-base-200 py-6 border-b border-base-300">
      <div class="container">
        <div class="flex flex-wrap items-end gap-3">
          <ExchangeFindsFindFilters v-model="filters" class="contents" />
          <NuxtLink v-if="isAuthenticated" to="/exchange/finds/submit" class="btn btn-primary btn-sm ml-auto">
            <i class="fas fa-plus"></i>
            {{ t('actions.submit') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <!-- Results Header -->
        <div class="flex items-center justify-between mb-6">
          <p class="text-base-content/70 text-sm">
            <span v-if="loading">{{ t('results.loading') }}</span>
            <span v-else-if="finds.length > 0">{{ t('results.showing', { shown: finds.length, total: totalCount }) }}</span>
            <span v-else>{{ t('results.none') }}</span>
          </p>
        </div>

        <!-- Loading Skeleton -->
        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="card bg-base-100 shadow-sm">
            <div class="skeleton aspect-video w-full"></div>
            <div class="card-body p-4 space-y-3">
              <div class="skeleton h-5 w-3/4"></div>
              <div class="skeleton h-4 w-1/2"></div>
              <div class="skeleton h-6 w-1/3"></div>
              <div class="skeleton h-3 w-full"></div>
            </div>
          </div>
        </div>

        <!-- Finds Grid -->
        <div v-else-if="finds.length > 0">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ExchangeFindsFindCard v-for="find in finds" :key="find.id" :find="find" />
          </div>

          <!-- Load More -->
          <div v-if="hasMore" class="flex justify-center mt-8">
            <button class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
              <span v-if="loadingMore" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fas fa-arrow-down text-xl"></i>
              {{ t('actions.loadMore') }}
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <i class="fas fa-globe text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
          <p class="text-base-content/70 mb-6">
            {{ t('empty.body') }}
          </p>
          <NuxtLink v-if="isAuthenticated" to="/exchange/finds/submit" class="btn btn-primary">
            {{ t('actions.submit') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { FindFilters } from '~/composables/useExternalListings';

  const { t } = useI18n();
  const config = useRuntimeConfig();
  const { user, isAuthenticated } = useAuth();
  const { capture } = usePostHog();
  const { finds, loading, totalCount, fetchFinds, loadUserInteractions } = useExternalListings();

  const canonicalUrl = `${config.public.siteUrl || 'https://www.classicminidiy.com'}/exchange/finds`;

  // SEO metadata
  useSeoMeta({
    title: t('seo.title'),
    description: t('seo.description'),
    ogTitle: t('seo.title'),
    ogDescription: t('seo.ogDescription'),
    ogType: 'website',
    ogUrl: canonicalUrl,
    ogImage: `${config.public.siteUrl || 'https://www.classicminidiy.com'}/og-image.jpg`,
    twitterCard: 'summary_large_image',
  });

  useHead({
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/exchange/finds' }],
  });

  // Filters state
  const filters = ref<FindFilters & { _sort?: string }>({});
  const currentPage = ref(1);
  const limit = 20;
  const loadingMore = ref(false);

  // Whether there are more results to load
  const hasMore = computed(() => finds.value.length < totalCount.value);

  // Fetch finds with current filters
  const loadFinds = async () => {
    const queryFilters: FindFilters = {
      sourceSite: filters.value.sourceSite,
      category: filters.value.category,
      tags: filters.value.tags,
      page: currentPage.value,
      limit,
    };

    await fetchFinds(queryFilters);
  };

  // Load more finds (next page)
  const loadMore = async () => {
    currentPage.value++;
    // For "load more" we need to append, but fetchFinds replaces the array.
    // We'll manually handle this by fetching and concatenating.
    loadingMore.value = true;
    const prevFinds = [...finds.value];

    await fetchFinds({
      sourceSite: filters.value.sourceSite,
      category: filters.value.category,
      tags: filters.value.tags,
      page: currentPage.value,
      limit,
    });

    // Prepend previous finds to the newly fetched ones
    finds.value = [...prevFinds, ...finds.value];
    loadingMore.value = false;
  };

  // Watch for filter changes and reload
  watch(
    filters,
    () => {
      currentPage.value = 1;
      loadFinds();

      capture('finds_browsed', {
        filters: {
          sourceSite: filters.value.sourceSite || null,
          category: filters.value.category || null,
          sort: (filters.value as any)._sort || 'newest',
        },
        page: currentPage.value,
      });
    },
    { deep: true }
  );

  // Initial load
  onMounted(() => {
    loadFinds();
    if (user.value) {
      loadUserInteractions();
    }
  });
</script>

<i18n lang="json">
{
  "en": {
    "hero": {
      "title": "Mini Finds",
      "intro": "Spotted a Classic Mini for sale somewhere on the web? So has our community. Mini Finds collects listings from Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay, and beyond — helping you discover Classic Minis for sale no matter where they turn up.",
      "count": "{count} find and counting. | {count} finds and counting."
    },
    "actions": { "submit": "Submit a Find", "loadMore": "Load More" },
    "results": {
      "loading": "Loading finds...",
      "showing": "Showing {shown} of {total} finds",
      "none": "No finds yet"
    },
    "empty": {
      "title": "No Finds Yet",
      "body": "Be the first to share an interesting Classic Mini listing from across the web."
    },
    "seo": {
      "title": "Mini Finds | Classic Mini DIY",
      "description": "Community-curated Classic Mini listings from Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay, and beyond. Discover Classic Minis for sale no matter where they turn up.",
      "ogDescription": "Community-curated Classic Mini listings from across the web. Discover Minis for sale on Bring a Trailer, Cars & Bids, eBay, and beyond."
    }
  },
  "es": {
    "hero": {
      "title": "Hallazgos Mini",
      "intro": "¿Has visto un Classic Mini en venta en algún sitio de la web? Nuestra comunidad también. Hallazgos Mini reúne anuncios de Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay y más — para ayudarte a descubrir Classic Minis en venta dondequiera que aparezcan.",
      "count": "{count} hallazgo y contando. | {count} hallazgos y contando."
    },
    "actions": { "submit": "Enviar un hallazgo", "loadMore": "Cargar más" },
    "results": {
      "loading": "Cargando hallazgos...",
      "showing": "Mostrando {shown} de {total} hallazgos",
      "none": "Aún no hay hallazgos"
    },
    "empty": {
      "title": "Aún no hay hallazgos",
      "body": "Sé el primero en compartir un anuncio interesante de un Classic Mini de cualquier parte de la web."
    },
    "seo": {
      "title": "Hallazgos Mini | Classic Mini DIY",
      "description": "Anuncios de Classic Mini seleccionados por la comunidad de Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay y más. Descubre Classic Minis en venta dondequiera que aparezcan.",
      "ogDescription": "Anuncios de Classic Mini seleccionados por la comunidad de toda la web. Descubre Minis en venta en Bring a Trailer, Cars & Bids, eBay y más."
    }
  },
  "fr": {
    "hero": {
      "title": "Trouvailles Mini",
      "intro": "Vous avez repéré une Classic Mini à vendre quelque part sur le web ? Notre communauté aussi. Trouvailles Mini rassemble les annonces de Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay et au-delà — pour vous aider à découvrir des Classic Mini à vendre où qu'elles apparaissent.",
      "count": "{count} trouvaille et plus encore. | {count} trouvailles et plus encore."
    },
    "actions": { "submit": "Soumettre une trouvaille", "loadMore": "Charger plus" },
    "results": {
      "loading": "Chargement des trouvailles...",
      "showing": "Affichage de {shown} sur {total} trouvailles",
      "none": "Aucune trouvaille pour le moment"
    },
    "empty": {
      "title": "Aucune trouvaille pour le moment",
      "body": "Soyez le premier à partager une annonce intéressante de Classic Mini repérée sur le web."
    },
    "seo": {
      "title": "Trouvailles Mini | Classic Mini DIY",
      "description": "Annonces de Classic Mini sélectionnées par la communauté depuis Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay et au-delà. Découvrez des Classic Mini à vendre où qu'elles apparaissent.",
      "ogDescription": "Annonces de Classic Mini sélectionnées par la communauté à travers le web. Découvrez des Mini à vendre sur Bring a Trailer, Cars & Bids, eBay et au-delà."
    }
  },
  "de": {
    "hero": {
      "title": "Mini-Funde",
      "intro": "Irgendwo im Netz einen Classic Mini zum Verkauf entdeckt? Unsere Community auch. Mini-Funde sammelt Inserate von Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay und mehr — damit du Classic Minis zum Verkauf findest, egal wo sie auftauchen.",
      "count": "{count} Fund und es werden mehr. | {count} Funde und es werden mehr."
    },
    "actions": { "submit": "Einen Fund einreichen", "loadMore": "Mehr laden" },
    "results": {
      "loading": "Funde werden geladen...",
      "showing": "{shown} von {total} Funden werden angezeigt",
      "none": "Noch keine Funde"
    },
    "empty": {
      "title": "Noch keine Funde",
      "body": "Sei der Erste, der ein interessantes Classic-Mini-Inserat aus dem Netz teilt."
    },
    "seo": {
      "title": "Mini-Funde | Classic Mini DIY",
      "description": "Von der Community kuratierte Classic-Mini-Inserate von Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay und mehr. Entdecke Classic Minis zum Verkauf, egal wo sie auftauchen.",
      "ogDescription": "Von der Community kuratierte Classic-Mini-Inserate aus dem ganzen Netz. Entdecke Minis zum Verkauf bei Bring a Trailer, Cars & Bids, eBay und mehr."
    }
  },
  "it": {
    "hero": {
      "title": "Trovate Mini",
      "intro": "Hai visto una Classic Mini in vendita da qualche parte sul web? Anche la nostra community. Trovate Mini raccoglie annunci da Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay e oltre — per aiutarti a scoprire Classic Mini in vendita ovunque appaiano.",
      "count": "{count} trovata e si continua. | {count} trovate e si continua."
    },
    "actions": { "submit": "Invia una trovata", "loadMore": "Carica altro" },
    "results": {
      "loading": "Caricamento trovate...",
      "showing": "Visualizzazione di {shown} su {total} trovate",
      "none": "Ancora nessuna trovata"
    },
    "empty": {
      "title": "Ancora nessuna trovata",
      "body": "Sii il primo a condividere un interessante annuncio di Classic Mini trovato sul web."
    },
    "seo": {
      "title": "Trovate Mini | Classic Mini DIY",
      "description": "Annunci di Classic Mini selezionati dalla community da Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay e oltre. Scopri Classic Mini in vendita ovunque appaiano.",
      "ogDescription": "Annunci di Classic Mini selezionati dalla community da tutto il web. Scopri Mini in vendita su Bring a Trailer, Cars & Bids, eBay e oltre."
    }
  },
  "pt": {
    "hero": {
      "title": "Achados Mini",
      "intro": "Viu um Classic Mini à venda em algum lugar na web? A nossa comunidade também. Achados Mini reúne anúncios de Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay e mais — para ajudar você a descobrir Classic Minis à venda onde quer que apareçam.",
      "count": "{count} achado e contando. | {count} achados e contando."
    },
    "actions": { "submit": "Enviar um achado", "loadMore": "Carregar mais" },
    "results": {
      "loading": "Carregando achados...",
      "showing": "Mostrando {shown} de {total} achados",
      "none": "Ainda sem achados"
    },
    "empty": {
      "title": "Ainda sem achados",
      "body": "Seja o primeiro a compartilhar um anúncio interessante de Classic Mini de qualquer parte da web."
    },
    "seo": {
      "title": "Achados Mini | Classic Mini DIY",
      "description": "Anúncios de Classic Mini selecionados pela comunidade de Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay e mais. Descubra Classic Minis à venda onde quer que apareçam.",
      "ogDescription": "Anúncios de Classic Mini selecionados pela comunidade de toda a web. Descubra Minis à venda no Bring a Trailer, Cars & Bids, eBay e mais."
    }
  },
  "ru": {
    "hero": {
      "title": "Находки Mini",
      "intro": "Заметили Classic Mini на продажу где-то в сети? Наше сообщество тоже. «Находки Mini» собирают объявления с Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay и не только — помогая вам находить Classic Mini на продажу, где бы они ни появились.",
      "count": "{count} находка и это не предел. | {count} находки и это не предел. | {count} находок и это не предел."
    },
    "actions": { "submit": "Добавить находку", "loadMore": "Загрузить ещё" },
    "results": {
      "loading": "Загрузка находок...",
      "showing": "Показано {shown} из {total} находок",
      "none": "Пока нет находок"
    },
    "empty": {
      "title": "Пока нет находок",
      "body": "Станьте первым, кто поделится интересным объявлением о Classic Mini со всего интернета."
    },
    "seo": {
      "title": "Находки Mini | Classic Mini DIY",
      "description": "Подобранные сообществом объявления о Classic Mini с Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay и не только. Находите Classic Mini на продажу, где бы они ни появились.",
      "ogDescription": "Подобранные сообществом объявления о Classic Mini со всего интернета. Находите Mini на продажу на Bring a Trailer, Cars & Bids, eBay и не только."
    }
  },
  "ja": {
    "hero": {
      "title": "Mini ファインド",
      "intro": "ウェブのどこかで売りに出ているクラシック Mini を見つけましたか？私たちのコミュニティも同じです。Mini ファインドは Bring a Trailer、Cars & Bids、Craigslist、Facebook、eBay などの出品を集め、どこに現れても売りに出ているクラシック Mini を見つけるお手伝いをします。",
      "count": "{count} 件のファインド、まだまだ増えています。"
    },
    "actions": { "submit": "ファインドを投稿", "loadMore": "もっと読み込む" },
    "results": {
      "loading": "ファインドを読み込み中...",
      "showing": "{total} 件中 {shown} 件を表示",
      "none": "まだファインドはありません"
    },
    "empty": {
      "title": "まだファインドはありません",
      "body": "ウェブで見つけた興味深いクラシック Mini の出品を最初に共有しましょう。"
    },
    "seo": {
      "title": "Mini ファインド | Classic Mini DIY",
      "description": "Bring a Trailer、Cars & Bids、Craigslist、Facebook、eBay などからコミュニティが厳選したクラシック Mini の出品。どこに現れても売りに出ているクラシック Mini を見つけましょう。",
      "ogDescription": "ウェブ全体からコミュニティが厳選したクラシック Mini の出品。Bring a Trailer、Cars & Bids、eBay などで売りに出ている Mini を見つけましょう。"
    }
  },
  "zh": {
    "hero": {
      "title": "Mini 发现",
      "intro": "在网上某处看到出售的经典 Mini 了吗？我们的社区也一样。Mini 发现汇集来自 Bring a Trailer、Cars & Bids、Craigslist、Facebook、eBay 等平台的刊登信息——帮助你无论在哪里都能发现待售的经典 Mini。",
      "count": "{count} 条发现，还在不断增加。"
    },
    "actions": { "submit": "提交发现", "loadMore": "加载更多" },
    "results": {
      "loading": "正在加载发现...",
      "showing": "显示 {total} 条中的 {shown} 条发现",
      "none": "暂无发现"
    },
    "empty": {
      "title": "暂无发现",
      "body": "成为第一个分享来自网络各处有趣经典 Mini 刊登的人。"
    },
    "seo": {
      "title": "Mini 发现 | Classic Mini DIY",
      "description": "由社区精选的经典 Mini 刊登信息，来自 Bring a Trailer、Cars & Bids、Craigslist、Facebook、eBay 等平台。无论在哪里都能发现待售的经典 Mini。",
      "ogDescription": "由社区精选、来自网络各处的经典 Mini 刊登信息。在 Bring a Trailer、Cars & Bids、eBay 等平台发现待售的 Mini。"
    }
  },
  "ko": {
    "hero": {
      "title": "Mini 파인드",
      "intro": "웹 어딘가에서 판매 중인 클래식 Mini를 발견하셨나요? 우리 커뮤니티도 마찬가지입니다. Mini 파인드는 Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay 등의 매물을 모아 어디에 등장하든 판매 중인 클래식 Mini를 발견하도록 도와드립니다.",
      "count": "{count}개의 파인드, 계속 늘어나고 있습니다."
    },
    "actions": { "submit": "파인드 제출", "loadMore": "더 보기" },
    "results": {
      "loading": "파인드를 불러오는 중...",
      "showing": "{total}개 중 {shown}개 파인드 표시 중",
      "none": "아직 파인드가 없습니다"
    },
    "empty": {
      "title": "아직 파인드가 없습니다",
      "body": "웹 곳곳에서 발견한 흥미로운 클래식 Mini 매물을 가장 먼저 공유해 보세요."
    },
    "seo": {
      "title": "Mini 파인드 | Classic Mini DIY",
      "description": "Bring a Trailer, Cars & Bids, Craigslist, Facebook, eBay 등에서 커뮤니티가 엄선한 클래식 Mini 매물. 어디에 등장하든 판매 중인 클래식 Mini를 발견하세요.",
      "ogDescription": "웹 곳곳에서 커뮤니티가 엄선한 클래식 Mini 매물. Bring a Trailer, Cars & Bids, eBay 등에서 판매 중인 Mini를 발견하세요."
    }
  }
}
</i18n>
