<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import type { BrowseCard } from '~~/data/models/external-models';
  import { EXTERNAL_SOURCES, SUPPORTED_SOURCE_SITES } from '~~/data/models/external-sources';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  // Filters (seeded from the URL so a shared link reproduces the view).
  const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
  const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
  const pricing = ref(typeof route.query.pricing === 'string' ? route.query.pricing : '');
  const source = ref(typeof route.query.source === 'string' ? route.query.source : '');
  const sort = ref(typeof route.query.sort === 'string' ? route.query.sort : 'newest');
  const page = ref(Number(route.query.page) || 1);

  // Debounced search term feeds the request (avoids a fetch per keystroke).
  const debouncedQ = ref(q.value);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(q, (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedQ.value = val;
      page.value = 1;
    }, 350);
  });

  // Reset to page 1 whenever a filter changes.
  watch([category, pricing, source, sort], () => {
    page.value = 1;
  });

  // External listings have no pricing — clear the pricing filter when an
  // external source is chosen so the two never combine into 0 results.
  watch(source, (val) => {
    if (val && val !== 'first_party') pricing.value = '';
  });

  const { data: categoriesData } = await useFetch('/api/models/categories');
  const categories = computed(() => categoriesData.value?.categories ?? []);

  const { data, status } = await useFetch('/api/models', {
    query: { q: debouncedQ, category, pricing, source, sort, page },
  });

  const models = computed<BrowseCard[]>(() => (data.value?.models ?? []) as BrowseCard[]);
  const total = computed(() => data.value?.total ?? 0);
  const hasMore = computed(() => data.value?.hasMore ?? false);

  // Keep the URL in sync so the view is shareable / back-button friendly.
  watch([debouncedQ, category, pricing, source, sort, page], () => {
    router.replace({
      query: {
        ...(debouncedQ.value ? { q: debouncedQ.value } : {}),
        ...(category.value ? { category: category.value } : {}),
        ...(pricing.value ? { pricing: pricing.value } : {}),
        ...(source.value ? { source: source.value } : {}),
        ...(sort.value !== 'newest' ? { sort: sort.value } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {}),
      },
    });
  });

  // "Paid" is an umbrella covering pwyw (min $1) + fixed — every model that costs
  // money to download. The server expands `paid` accordingly.
  const pricingOptions = computed(() => [
    { value: '', label: t('filters.pricing.all') },
    { value: 'free', label: t('filters.pricing.free') },
    { value: 'tips', label: t('filters.pricing.tips') },
    { value: 'paid', label: t('filters.pricing.paid') },
  ]);
  const sortOptions = computed(() => [
    { value: 'newest', label: t('filters.sort.newest') },
    { value: 'popular', label: t('filters.sort.popular') },
    { value: 'likes', label: t('filters.sort.likes') },
    { value: 'featured', label: t('filters.sort.featured') },
  ]);
  const sourceOptions = computed(() => [
    { value: '', label: t('filters.source.all') },
    { value: 'first_party', label: t('filters.source.firstParty') },
    { value: 'external', label: t('filters.source.external') },
    ...SUPPORTED_SOURCE_SITES.map((s) => ({ value: s, label: EXTERNAL_SOURCES[s].label })),
  ]);

  function clearFilters() {
    q.value = '';
    debouncedQ.value = '';
    category.value = '';
    pricing.value = '';
    source.value = '';
    sort.value = 'newest';
    page.value = 1;
  }

  // Categories store icons in Iconify form (e.g. "i-fa6-solid-couch"); the rest
  // of the site renders Font Awesome via class names, so convert.
  function faIcon(iconify?: string | null): string {
    if (!iconify) return 'fas fa-cube';
    const m = iconify.match(/^i-fa6-(solid|regular|brands)-(.+)$/);
    if (!m) return iconify.startsWith('fa-') ? `fas ${iconify}` : `fas fa-${iconify}`;
    const style = m[1] === 'solid' ? 'fas' : m[1] === 'regular' ? 'far' : 'fab';
    return `${style} fa-${m[2]}`;
  }

  useHead({ title: '3D Model Library | Classic Mini DIY' });
  useSeoMeta({
    description:
      'Browse and download 3D-printable parts for the Classic Mini — interior trim, brackets, gauge pods, tools and jigs, with full print settings.',
    ogTitle: '3D Model Library | Classic Mini DIY',
    ogDescription: 'Mini-specific 3D-printable parts with print settings, hardware lists, and assembly guides.',
    ogType: 'website',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero.title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="t('breadcrumb')" />
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div class="flex-1">
            <PageIntro
              :eyebrow="t('intro.eyebrow')"
              :title="t('intro.title')"
              :description="t('intro.description')"
              as="h2"
            />
          </div>
          <div class="flex gap-2 shrink-0">
            <NuxtLink to="/models/upload" class="btn btn-primary"
              ><i class="fas fa-plus mr-1"></i> {{ t('actions.share') }}</NuxtLink
            >
            <NuxtLink to="/dashboard/models" class="btn btn-ghost"><i class="fas fa-folder mr-1"></i> {{ t('actions.myModels') }}</NuxtLink>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="col-span-12">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-4 gap-4">
            <div class="flex flex-col md:flex-row gap-3">
              <label class="input w-full md:flex-1">
                <i class="fas fa-magnifying-glass opacity-50"></i>
                <input v-model="q" type="search" :placeholder="t('filters.searchPlaceholder')" :aria-label="t('filters.searchLabel')" />
              </label>
              <select v-model="source" class="select w-full md:w-auto" :aria-label="t('filters.sourceLabel')">
                <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <select
                v-model="pricing"
                class="select w-full md:w-auto"
                :disabled="!!source && source !== 'first_party'"
                :aria-label="t('filters.pricingLabel')"
              >
                <option v-for="opt in pricingOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <select v-model="sort" class="select w-full md:w-auto" :aria-label="t('filters.sortLabel')">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div v-if="categories.length" class="flex flex-wrap gap-2">
              <button class="btn btn-sm" :class="category === '' ? 'btn-primary' : 'btn-ghost'" @click="category = ''">
                {{ t('filters.allCategories') }}
              </button>
              <button
                v-for="cat in categories"
                :key="cat.slug"
                class="btn btn-sm gap-1"
                :class="category === cat.slug ? 'btn-primary' : 'btn-ghost'"
                @click="category = cat.slug"
              >
                <i :class="faIcon(cat.icon)"></i>
                {{ cat.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="col-span-12">
        <div class="flex items-center justify-between mb-4 text-sm opacity-70">
          <span>{{ t('results.count', { count: total }) }}</span>
          <button
            v-if="q || category || pricing || source || sort !== 'newest'"
            class="btn btn-ghost btn-xs"
            @click="clearFilters"
          >
            <i class="fas fa-xmark mr-1"></i> {{ t('results.clearFilters') }}
          </button>
        </div>

        <div v-if="status === 'pending'" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <div v-else-if="models.length === 0" class="text-center py-16">
          <i class="fas fa-cube text-5xl opacity-20"></i>
          <p class="mt-4 text-lg font-semibold">{{ t('empty.title') }}</p>
          <p class="opacity-60">{{ t('empty.hint') }}</p>
        </div>

        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <template v-for="model in models" :key="model.id">
            <ModelsExternalModelCard v-if="model.kind === 'external'" :model="model" />
            <ModelsModelCard v-else :model="model" />
          </template>
        </div>

        <!-- Pagination -->
        <div v-if="models.length && (page > 1 || hasMore)" class="flex justify-center mt-8">
          <div class="join">
            <button class="join-item btn" :disabled="page <= 1" @click="page--">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="join-item btn btn-disabled">{{ t('pagination.page', { page }) }}</button>
            <button class="join-item btn" :disabled="!hasMore" @click="page++">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="col-span-12">
        <div class="divider mt-2 mb-0"></div>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10 pt-4">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "3D Model Library" },
    "breadcrumb": "3D Models",
    "intro": {
      "eyebrow": "MAKE",
      "title": "3D Model Library",
      "description": "Mini-specific 3D-printable parts — interior trim, brackets, gauge pods, tools and jigs — with full print settings, hardware lists, and assembly guides. Contributed by the community."
    },
    "actions": {
      "share": "Share a model",
      "myModels": "My models"
    },
    "filters": {
      "sourceLabel": "Filter by source",
      "source": { "all": "All sources", "firstParty": "Classic Mini DIY", "external": "Around the web" },
      "searchPlaceholder": "Search models…",
      "searchLabel": "Search models",
      "pricingLabel": "Filter by pricing",
      "sortLabel": "Sort",
      "allCategories": "All",
      "pricing": {
        "all": "All pricing",
        "free": "Free",
        "tips": "Free + tips",
        "paid": "Paid"
      },
      "sort": {
        "newest": "Newest",
        "popular": "Most downloaded",
        "likes": "Most liked",
        "featured": "Featured"
      }
    },
    "results": {
      "count": "{count} models",
      "clearFilters": "Clear filters"
    },
    "empty": {
      "title": "No models found",
      "hint": "Try a different search or clear your filters."
    },
    "pagination": {
      "page": "Page {page}"
    }
  },
  "es": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": "Modelos 3D",
    "intro": {
      "eyebrow": "CREAR",
      "title": "Biblioteca de modelos 3D",
      "description": "Piezas imprimibles en 3D específicas para el Mini — tapicería interior, soportes, cápsulas de instrumentos, herramientas y plantillas — con ajustes de impresión, listas de hardware y guías de montaje. Aportadas por la comunidad."
    },
    "actions": {
      "share": "Compartir modelo",
      "myModels": "Mis modelos"
    },
    "filters": {
      "sourceLabel": "Filtrar por origen",
      "source": { "all": "Todas las fuentes", "firstParty": "Classic Mini DIY", "external": "De la web" },
      "searchPlaceholder": "Buscar modelos…",
      "searchLabel": "Buscar modelos",
      "pricingLabel": "Filtrar por precio",
      "sortLabel": "Ordenar",
      "allCategories": "Todos",
      "pricing": {
        "all": "Todos los precios",
        "free": "Gratis",
        "tips": "Gratis + propinas",
        "paid": "De pago"
      },
      "sort": {
        "newest": "Más recientes",
        "popular": "Más descargados",
        "likes": "Más valorados",
        "featured": "Destacados"
      }
    },
    "results": {
      "count": "{count} modelos",
      "clearFilters": "Limpiar filtros"
    },
    "empty": {
      "title": "No se encontraron modelos",
      "hint": "Prueba otra búsqueda o elimina los filtros."
    },
    "pagination": {
      "page": "Página {page}"
    }
  },
  "fr": {
    "hero": { "title": "Bibliothèque de modèles 3D" },
    "breadcrumb": "Modèles 3D",
    "intro": {
      "eyebrow": "CRÉER",
      "title": "Bibliothèque de modèles 3D",
      "description": "Pièces imprimables en 3D spécifiques à la Mini — garnitures intérieures, supports, pods de jauges, outils et gabarits — avec réglages d'impression complets, listes de matériel et guides d'assemblage. Contribué par la communauté."
    },
    "actions": {
      "share": "Partager un modèle",
      "myModels": "Mes modèles"
    },
    "filters": {
      "sourceLabel": "Filtrer par source",
      "source": { "all": "Toutes les sources", "firstParty": "Classic Mini DIY", "external": "Ailleurs sur le web" },
      "searchPlaceholder": "Rechercher des modèles…",
      "searchLabel": "Rechercher des modèles",
      "pricingLabel": "Filtrer par tarif",
      "sortLabel": "Trier",
      "allCategories": "Tous",
      "pricing": {
        "all": "Tous les tarifs",
        "free": "Gratuit",
        "tips": "Gratuit + pourboires",
        "paid": "Payant"
      },
      "sort": {
        "newest": "Les plus récents",
        "popular": "Les plus téléchargés",
        "likes": "Les plus aimés",
        "featured": "En vedette"
      }
    },
    "results": {
      "count": "{count} modèles",
      "clearFilters": "Effacer les filtres"
    },
    "empty": {
      "title": "Aucun modèle trouvé",
      "hint": "Essayez une autre recherche ou effacez vos filtres."
    },
    "pagination": {
      "page": "Page {page}"
    }
  },
  "de": {
    "hero": { "title": "3D-Modellbibliothek" },
    "breadcrumb": "3D-Modelle",
    "intro": {
      "eyebrow": "ERSTELLEN",
      "title": "3D-Modellbibliothek",
      "description": "Mini-spezifische 3D-druckbare Teile — Innenverkleidungen, Halterungen, Instrumentengehäuse, Werkzeuge und Schablonen — mit vollständigen Druckeinstellungen, Teilelistenund Montageanleitung. Von der Community beigesteuert."
    },
    "actions": {
      "share": "Modell teilen",
      "myModels": "Meine Modelle"
    },
    "filters": {
      "sourceLabel": "Nach Quelle filtern",
      "source": { "all": "Alle Quellen", "firstParty": "Classic Mini DIY", "external": "Aus dem Web" },
      "searchPlaceholder": "Modelle suchen…",
      "searchLabel": "Modelle suchen",
      "pricingLabel": "Nach Preis filtern",
      "sortLabel": "Sortieren",
      "allCategories": "Alle",
      "pricing": {
        "all": "Alle Preise",
        "free": "Kostenlos",
        "tips": "Kostenlos + Trinkgeld",
        "paid": "Kostenpflichtig"
      },
      "sort": {
        "newest": "Neueste",
        "popular": "Meiste Downloads",
        "likes": "Meiste Likes",
        "featured": "Empfohlen"
      }
    },
    "results": {
      "count": "{count} Modelle",
      "clearFilters": "Filter zurücksetzen"
    },
    "empty": {
      "title": "Keine Modelle gefunden",
      "hint": "Versuche eine andere Suche oder setze die Filter zurück."
    },
    "pagination": {
      "page": "Seite {page}"
    }
  },
  "it": {
    "hero": { "title": "Libreria modelli 3D" },
    "breadcrumb": "Modelli 3D",
    "intro": {
      "eyebrow": "CREA",
      "title": "Libreria modelli 3D",
      "description": "Pezzi stampabili in 3D specifici per la Mini — rivestimenti interni, staffe, pod per strumenti, utensili e dime — con impostazioni di stampa complete, liste hardware e guide al montaggio. Contribuiti dalla community."
    },
    "actions": {
      "share": "Condividi un modello",
      "myModels": "I miei modelli"
    },
    "filters": {
      "sourceLabel": "Filtra per fonte",
      "source": { "all": "Tutte le fonti", "firstParty": "Classic Mini DIY", "external": "Dal web" },
      "searchPlaceholder": "Cerca modelli…",
      "searchLabel": "Cerca modelli",
      "pricingLabel": "Filtra per prezzo",
      "sortLabel": "Ordina",
      "allCategories": "Tutti",
      "pricing": {
        "all": "Tutti i prezzi",
        "free": "Gratuito",
        "tips": "Gratuito + mance",
        "paid": "A pagamento"
      },
      "sort": {
        "newest": "Più recenti",
        "popular": "Più scaricati",
        "likes": "Più apprezzati",
        "featured": "In evidenza"
      }
    },
    "results": {
      "count": "{count} modelli",
      "clearFilters": "Cancella filtri"
    },
    "empty": {
      "title": "Nessun modello trovato",
      "hint": "Prova una ricerca diversa o cancella i filtri."
    },
    "pagination": {
      "page": "Pagina {page}"
    }
  },
  "pt": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": "Modelos 3D",
    "intro": {
      "eyebrow": "CRIAR",
      "title": "Biblioteca de modelos 3D",
      "description": "Peças imprimíveis em 3D específicas para o Mini — acabamentos interiores, suportes, cápsulas de instrumentos, ferramentas e gabaritos — com configurações de impressão completas, listas de hardware e guias de montagem. Contribuídas pela comunidade."
    },
    "actions": {
      "share": "Partilhar modelo",
      "myModels": "Os meus modelos"
    },
    "filters": {
      "sourceLabel": "Filtrar por origem",
      "source": { "all": "Todas as fontes", "firstParty": "Classic Mini DIY", "external": "Da web" },
      "searchPlaceholder": "Pesquisar modelos…",
      "searchLabel": "Pesquisar modelos",
      "pricingLabel": "Filtrar por preço",
      "sortLabel": "Ordenar",
      "allCategories": "Todos",
      "pricing": {
        "all": "Todos os preços",
        "free": "Grátis",
        "tips": "Grátis + gorjetas",
        "paid": "Pago"
      },
      "sort": {
        "newest": "Mais recentes",
        "popular": "Mais descarregados",
        "likes": "Mais apreciados",
        "featured": "Em destaque"
      }
    },
    "results": {
      "count": "{count} modelos",
      "clearFilters": "Limpar filtros"
    },
    "empty": {
      "title": "Nenhum modelo encontrado",
      "hint": "Tente outra pesquisa ou limpe os filtros."
    },
    "pagination": {
      "page": "Página {page}"
    }
  },
  "ru": {
    "hero": { "title": "Библиотека 3D-моделей" },
    "breadcrumb": "3D-модели",
    "intro": {
      "eyebrow": "СОЗДАТЬ",
      "title": "Библиотека 3D-моделей",
      "description": "3D-печатные детали для Mini — отделка салона, кронштейны, корпуса приборов, инструменты и шаблоны — с полными настройками печати, списками фурнитуры и инструкциями по сборке. Предоставлено сообществом."
    },
    "actions": {
      "share": "Поделиться моделью",
      "myModels": "Мои модели"
    },
    "filters": {
      "sourceLabel": "Фильтр по источнику",
      "source": { "all": "Все источники", "firstParty": "Classic Mini DIY", "external": "Со всего веба" },
      "searchPlaceholder": "Поиск моделей…",
      "searchLabel": "Поиск моделей",
      "pricingLabel": "Фильтр по цене",
      "sortLabel": "Сортировка",
      "allCategories": "Все",
      "pricing": {
        "all": "Любая цена",
        "free": "Бесплатно",
        "tips": "Бесплатно + чаевые",
        "paid": "Платно"
      },
      "sort": {
        "newest": "Новые",
        "popular": "Популярные",
        "likes": "Понравившиеся",
        "featured": "Рекомендуемые"
      }
    },
    "results": {
      "count": "{count} моделей",
      "clearFilters": "Сбросить фильтры"
    },
    "empty": {
      "title": "Модели не найдены",
      "hint": "Попробуйте другой запрос или сбросьте фильтры."
    },
    "pagination": {
      "page": "Страница {page}"
    }
  },
  "ja": {
    "hero": { "title": "3Dモデルライブラリ" },
    "breadcrumb": "3Dモデル",
    "intro": {
      "eyebrow": "制作",
      "title": "3Dモデルライブラリ",
      "description": "Mini専用の3Dプリント部品 — インテリアトリム、ブラケット、ゲージポッド、ツールとジグ — 印刷設定、パーツリスト、組み立てガイド付き。コミュニティが提供。"
    },
    "actions": {
      "share": "モデルを共有",
      "myModels": "マイモデル"
    },
    "filters": {
      "sourceLabel": "ソースで絞り込む",
      "source": { "all": "すべてのソース", "firstParty": "Classic Mini DIY", "external": "ウェブ上から" },
      "searchPlaceholder": "モデルを検索…",
      "searchLabel": "モデルを検索",
      "pricingLabel": "価格でフィルター",
      "sortLabel": "並び替え",
      "allCategories": "すべて",
      "pricing": {
        "all": "すべての価格",
        "free": "無料",
        "tips": "無料＋チップ",
        "paid": "有料"
      },
      "sort": {
        "newest": "新着順",
        "popular": "ダウンロード数順",
        "likes": "いいね順",
        "featured": "おすすめ"
      }
    },
    "results": {
      "count": "{count}件のモデル",
      "clearFilters": "フィルターをクリア"
    },
    "empty": {
      "title": "モデルが見つかりません",
      "hint": "別のキーワードで検索するか、フィルターをクリアしてください。"
    },
    "pagination": {
      "page": "{page}ページ"
    }
  },
  "zh": {
    "hero": { "title": "3D模型库" },
    "breadcrumb": "3D模型",
    "intro": {
      "eyebrow": "制作",
      "title": "3D模型库",
      "description": "Mini专属3D打印零件 — 内饰装饰、支架、仪表舱、工具和夹具 — 附完整打印设置、配件清单和组装指南。由社区贡献。"
    },
    "actions": {
      "share": "分享模型",
      "myModels": "我的模型"
    },
    "filters": {
      "sourceLabel": "按来源筛选",
      "source": { "all": "所有来源", "firstParty": "Classic Mini DIY", "external": "来自网络" },
      "searchPlaceholder": "搜索模型…",
      "searchLabel": "搜索模型",
      "pricingLabel": "按价格筛选",
      "sortLabel": "排序",
      "allCategories": "全部",
      "pricing": {
        "all": "全部价格",
        "free": "免费",
        "tips": "免费 + 打赏",
        "paid": "付费"
      },
      "sort": {
        "newest": "最新",
        "popular": "下载最多",
        "likes": "最多点赞",
        "featured": "精选"
      }
    },
    "results": {
      "count": "{count} 个模型",
      "clearFilters": "清除筛选"
    },
    "empty": {
      "title": "未找到模型",
      "hint": "请尝试其他搜索词或清除筛选条件。"
    },
    "pagination": {
      "page": "第 {page} 页"
    }
  },
  "ko": {
    "hero": { "title": "3D 모델 라이브러리" },
    "breadcrumb": "3D 모델",
    "intro": {
      "eyebrow": "제작",
      "title": "3D 모델 라이브러리",
      "description": "Mini 전용 3D 프린팅 부품 — 인테리어 트림, 브라켓, 게이지 포드, 툴 및 지그 — 완전한 출력 설정, 하드웨어 목록, 조립 가이드 포함. 커뮤니티가 기여."
    },
    "actions": {
      "share": "모델 공유",
      "myModels": "내 모델"
    },
    "filters": {
      "sourceLabel": "출처로 필터",
      "source": { "all": "모든 출처", "firstParty": "Classic Mini DIY", "external": "웹에서" },
      "searchPlaceholder": "모델 검색…",
      "searchLabel": "모델 검색",
      "pricingLabel": "가격으로 필터",
      "sortLabel": "정렬",
      "allCategories": "전체",
      "pricing": {
        "all": "모든 가격",
        "free": "무료",
        "tips": "무료 + 후원",
        "paid": "유료"
      },
      "sort": {
        "newest": "최신순",
        "popular": "다운로드순",
        "likes": "좋아요순",
        "featured": "추천"
      }
    },
    "results": {
      "count": "모델 {count}개",
      "clearFilters": "필터 초기화"
    },
    "empty": {
      "title": "모델을 찾을 수 없습니다",
      "hint": "다른 검색어를 사용하거나 필터를 초기화하세요."
    },
    "pagination": {
      "page": "{page}페이지"
    }
  }
}
</i18n>
