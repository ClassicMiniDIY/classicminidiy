<template>
  <div>
    <h1 class="sr-only">{{ t('seo.srHeading') }}</h1>

    <!-- Site Announcement Banner -->
    <ExchangeAnnouncementBanner />

    <!-- Search Box -->
    <section class="bg-base-100 py-6 border-b border-base-300">
      <div class="container max-w-2xl">
        <form @submit.prevent="goToSearch">
          <div class="join w-full">
            <input
              v-model="homeSearchQuery"
              type="text"
              :placeholder="t('search.placeholder')"
              class="input join-item flex-1"
            />
            <button type="submit" class="btn btn-primary join-item">
              <i class="fas fa-magnifying-glass text-base"></i>
              {{ t('search.button') }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Country Flag Marquee -->
    <ExchangeHomeFlagMarquee />

    <!-- Stats Bar (compact, inline) -->
    <section class="py-6 bg-base-200/50 border-y border-base-300">
      <div class="container">
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
          <div v-if="statsLoading" class="loading loading-dots loading-sm"></div>
          <template v-else>
            <div>
              <span class="text-2xl font-bold text-primary">{{ stats.totalListings }}</span>
              <span class="text-sm text-base-content/60 ml-1.5">{{ t('stats.activeListings') }}</span>
            </div>
            <div class="text-base-content/20">|</div>
            <div>
              <span class="text-2xl font-bold text-primary">{{ stats.countries }}</span>
              <span class="text-sm text-base-content/60 ml-1.5">{{ t('stats.countries') }}</span>
            </div>
            <div class="text-base-content/20">|</div>
            <div>
              <span class="text-2xl font-bold text-primary">{{ stats.soldListings }}</span>
              <span class="text-sm text-base-content/60 ml-1.5">{{ t('stats.soldThisMonth') }}</span>
            </div>
            <div class="text-base-content/20">|</div>
            <div>
              <span class="text-2xl font-bold text-primary">{{ stats.newThisWeek }}</span>
              <span class="text-sm text-base-content/60 ml-1.5">{{ t('stats.newThisWeek') }}</span>
            </div>
          </template>
        </div>
      </div>
    </section>
    <!-- Featured Listings Grid (Premium tier - most prominent) -->
    <ExchangeHomeFeaturedGrid v-if="featuredListings.length > 0" :listings="featuredListings" :user-currency="userCurrency" />

    <!-- Staff Favorites (future feature)
    <ExchangeHomePromotedListings
      v-if="promotedListings.length > 0"
      :listings="promotedListings"
      :user-currency="userCurrency"
    />
    -->

    <!-- CTA Section (two buttons: free vs premium) -->
    <section class="py-16">
      <div class="container">
        <div class="card bg-primary/10">
          <div class="card-body items-center text-center py-12">
            <h2 class="card-title text-3xl mb-4">{{ t('cta.title') }}</h2>
            <p class="text-lg text-base-content/70 mb-6 max-w-2xl">
              {{ t('cta.body') }}
            </p>
            <div class="flex flex-col sm:flex-row gap-3">
              <NuxtLink to="/exchange/listings/new" class="btn btn-primary btn-lg" @click="trackCta('get_started')">
                {{ t('cta.listFree') }}
              </NuxtLink>
              <NuxtLink to="/exchange/listings/new" class="btn btn-outline btn-lg" @click="trackCta('go_premium')">
                {{ t('cta.goPremium') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Recent Listings (card grid, BaT-style) -->
    <section class="py-12">
      <div class="container">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-2xl font-bold tracking-tight">{{ t('recent.heading') }}</h2>
          <NuxtLink to="/exchange/listings" class="btn btn-ghost btn-sm gap-1" @click="trackCta('view_all_recent')">
            {{ t('recent.viewAll') }}
            <i class="fas fa-arrow-right text-sm"></i>
          </NuxtLink>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <div v-for="i in 8" :key="i" class="skeleton aspect-[4/3] rounded-lg"></div>
        </div>

        <!-- Card Grid (image-forward like BaT) -->
        <div
          v-else-if="recentListings.length > 0"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <ExchangeListingsListingCard
            v-for="listing in recentListings"
            :key="listing.id"
            :listing="listing"
            variant="card"
            :show-seller-info="false"
            :user-currency="userCurrency"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('recent.emptyTitle') }}</h3>
          <p class="text-base-content/70 mb-6">{{ t('recent.emptyBody') }}</p>
          <NuxtLink to="/exchange/listings/new" class="btn btn-primary" @click="trackCta('create_listing_empty_state')">
            {{ t('recent.emptyAction') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features Section (updated with worldwide card) -->
    <section class="py-16 bg-base-200">
      <div class="container">
        <h2 class="text-2xl font-bold text-center mb-10 tracking-tight">{{ t('features.heading') }}</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-earth-americas text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.worldwide.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.worldwide.body') }}
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-screwdriver-wrench text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.expertise.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.expertise.body') }}
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-gift text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.free.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.free.body') }}
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-camera text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.photos.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.photos.body') }}
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-file-lines text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.heritage.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.heritage.body') }}
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm">
            <div class="card-body items-center text-center">
              <i class="fas fa-comments text-4xl text-primary mb-3"></i>
              <h3 class="card-title text-base">{{ t('features.communication.title') }}</h3>
              <p class="text-sm text-base-content/70">
                {{ t('features.communication.body') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  const { t } = useI18n();
  const config = useRuntimeConfig();
  const router = useRouter();
  const { capture } = usePostHog();
  const { userCurrency } = useCurrency();

  const homeSearchQuery = ref('');

  const goToSearch = () => {
    const query = homeSearchQuery.value.trim();
    if (!query) return;
    capture('search_performed', { query, source: 'home_page' });
    router.push({ path: '/exchange/listings', query: { search: query } });
  };

  const trackCta = (ctaName: string) => {
    capture('cta_clicked', {
      cta_name: ctaName,
      location: 'home_page',
    });
  };

  // SEO metadata (updated for worldwide messaging)
  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.shareDescription'),
    ogType: 'website',
    ogUrl: `${config.public.siteUrl}/exchange`,
    ogImage: `${config.public.siteUrl}/og-image.jpg`,
    twitterCard: 'summary_large_image',
    twitterTitle: () => t('seo.title'),
    twitterDescription: () => t('seo.shareDescription'),
  });

  // Schema.org WebSite markup
  useSchemaOrg([
    {
      '@type': 'WebSite',
      name: 'The Mini Exchange',
      url: `${config.public.siteUrl}/exchange`,
      description:
        'The premier marketplace for buying and selling Classic Mini Coopers with detailed photo galleries and specifications.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${config.public.siteUrl}/exchange/listings?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ]);

  const supabase = useSupabase();
  const { loadVisibility, activeStatuses } = useExampleListings();

  const loading = ref(true);
  const statsLoading = ref(true);
  const recentListings = ref<ListingWithPhotos[]>([]);
  const featuredListings = ref<ListingWithPhotos[]>([]);
  // const promotedListings = ref<ListingWithPhotos[]>([]); // Staff Favorites (future feature)

  const stats = ref({
    totalListings: 0,
    soldListings: 0,
    newThisWeek: 0,
    countries: 0,
  });

  // Fetch statistics (updated with countries count)
  const loadStatistics = async () => {
    try {
      // Total active listings
      const { count: totalCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      stats.value.totalListings = totalCount || 0;

      // Sold this month
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { count: soldCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sold')
        .gte('updated_at', firstDayOfMonth.toISOString());

      stats.value.soldListings = soldCount || 0;

      // New this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: newCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('created_at', oneWeekAgo.toISOString());

      stats.value.newThisWeek = newCount || 0;

      // Distinct countries (select only country column, cap at 5000 for safety)
      const { data: countryData } = await supabase
        .from('listings')
        .select('country')
        .eq('status', 'active')
        .not('country', 'is', null)
        .limit(5000);

      if (countryData) {
        const uniqueCountries = new Set(countryData.map((l: { country: string }) => l.country).filter(Boolean));
        stats.value.countries = uniqueCountries.size;
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      statsLoading.value = false;
    }
  };

  // Fetch featured (paid tier) listings
  const loadFeaturedListings = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
          *,
          listing_photos (id, storage_path, display_order, category, caption, is_primary),
          profiles:public_profiles!listings_user_id_fkey (id, display_name, username, location, avatar_url)
        `
          )
          .in('status', activeStatuses.value)
          .eq('tier', 'paid')
          .gte('featured_until', now)
          .order('created_at', { ascending: false })
      ).limit(6);

      if (!error) {
        featuredListings.value = sortExamplesLast(data || []);
      }
    } catch (error) {
      console.error('Error loading featured listings:', error);
    }
  };

  // Staff Favorites (future feature)
  // const loadPromotedListings = async () => { ... };

  // Fetch recent active listings
  const loadRecentListings = async () => {
    try {
      const { data, error } = await applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
          *,
          listing_photos (id, storage_path, display_order, category, caption, is_primary),
          profiles:public_profiles!listings_user_id_fkey (id, display_name, username, location, avatar_url)
        `
          )
          .in('status', activeStatuses.value)
          .order('created_at', { ascending: false })
      ).limit(12);

      if (!error) {
        recentListings.value = sortExamplesLast(data || []);
      }
    } catch (error) {
      console.error('Error loading recent listings:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(async () => {
    await loadVisibility();
    await Promise.all([loadStatistics(), loadFeaturedListings(), loadRecentListings()]);
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "The Mini Exchange - Classic Mini Classifieds Worldwide",
      "description": "The marketplace for Classic Minis. Buy and sell vehicles, engines, and parts from the worldwide Mini community.",
      "shareDescription": "Buy and sell Classic Mini vehicles, engines, and parts from enthusiasts worldwide.",
      "srHeading": "The Mini Exchange - Classic Mini Cooper Classifieds Worldwide"
    },
    "search": {
      "placeholder": "Search Classic Mini listings...",
      "button": "Search"
    },
    "stats": {
      "activeListings": "active listings",
      "countries": "countries",
      "soldThisMonth": "sold this month",
      "newThisWeek": "new this week"
    },
    "cta": {
      "title": "Ready to List Something?",
      "body": "Reach Classic Mini enthusiasts worldwide. List for free or go Premium for featured placement and priority in search results.",
      "listFree": "List for Free",
      "goPremium": "Go Premium — $10"
    },
    "recent": {
      "heading": "Recent Listings",
      "viewAll": "View All",
      "emptyTitle": "No listings yet",
      "emptyBody": "Be the first to post!",
      "emptyAction": "Create a Listing"
    },
    "features": {
      "heading": "Why The Mini Exchange?",
      "worldwide": {
        "title": "Worldwide Marketplace",
        "body": "Buy and sell across the globe with 15 supported currencies. Prices convert automatically to your preferred currency."
      },
      "expertise": {
        "title": "Classic Mini Expertise",
        "body": "Built by enthusiasts. 50+ Mini-specific fields for heritage, modifications, and authenticity tracking."
      },
      "free": {
        "title": "Free to List",
        "body": "No upfront costs. Go Premium for $10 to get featured placement, more photos, and priority search results."
      },
      "photos": {
        "title": "Photo Galleries",
        "body": "Showcase every detail with organized photo categories: body, engine, interior, and details."
      },
      "heritage": {
        "title": "Heritage Documentation",
        "body": "Track VIN numbers, BMIHT heritage certificates, original colors, and service history."
      },
      "communication": {
        "title": "Direct Communication",
        "body": "Built-in messaging plus public Q&A comments for community knowledge sharing."
      }
    }
  },
  "es": {
    "seo": {
      "title": "The Mini Exchange - Anuncios de Classic Mini en todo el mundo",
      "description": "El mercado para Classic Minis. Compra y vende vehículos, motores y piezas de la comunidad Mini mundial.",
      "shareDescription": "Compra y vende vehículos, motores y piezas de Classic Mini de entusiastas de todo el mundo.",
      "srHeading": "The Mini Exchange - Anuncios de Classic Mini Cooper en todo el mundo"
    },
    "search": {
      "placeholder": "Buscar anuncios de Classic Mini...",
      "button": "Buscar"
    },
    "stats": {
      "activeListings": "anuncios activos",
      "countries": "países",
      "soldThisMonth": "vendidos este mes",
      "newThisWeek": "nuevos esta semana"
    },
    "cta": {
      "title": "¿Listo para publicar algo?",
      "body": "Llega a entusiastas del Classic Mini en todo el mundo. Publica gratis o hazte Premium para obtener posicionamiento destacado y prioridad en los resultados de búsqueda.",
      "listFree": "Publicar gratis",
      "goPremium": "Hazte Premium — $10"
    },
    "recent": {
      "heading": "Anuncios recientes",
      "viewAll": "Ver todo",
      "emptyTitle": "Aún no hay anuncios",
      "emptyBody": "¡Sé el primero en publicar!",
      "emptyAction": "Crear un anuncio"
    },
    "features": {
      "heading": "¿Por qué The Mini Exchange?",
      "worldwide": {
        "title": "Mercado mundial",
        "body": "Compra y vende en todo el mundo con 15 divisas compatibles. Los precios se convierten automáticamente a tu moneda preferida."
      },
      "expertise": {
        "title": "Experiencia en Classic Mini",
        "body": "Creado por entusiastas. Más de 50 campos específicos del Mini para seguimiento de herencia, modificaciones y autenticidad."
      },
      "free": {
        "title": "Publicación gratuita",
        "body": "Sin costes iniciales. Hazte Premium por $10 para obtener posicionamiento destacado, más fotos y prioridad en los resultados de búsqueda."
      },
      "photos": {
        "title": "Galerías de fotos",
        "body": "Muestra cada detalle con categorías de fotos organizadas: carrocería, motor, interior y detalles."
      },
      "heritage": {
        "title": "Documentación de herencia",
        "body": "Registra números VIN, certificados de herencia BMIHT, colores originales e historial de mantenimiento."
      },
      "communication": {
        "title": "Comunicación directa",
        "body": "Mensajería integrada más comentarios de preguntas y respuestas públicas para compartir conocimiento en la comunidad."
      }
    }
  },
  "fr": {
    "seo": {
      "title": "The Mini Exchange - Petites annonces Classic Mini dans le monde entier",
      "description": "Le marché pour les Classic Minis. Achetez et vendez des véhicules, moteurs et pièces au sein de la communauté Mini mondiale.",
      "shareDescription": "Achetez et vendez des véhicules, moteurs et pièces Classic Mini auprès d'enthousiastes du monde entier.",
      "srHeading": "The Mini Exchange - Petites annonces Classic Mini Cooper dans le monde entier"
    },
    "search": {
      "placeholder": "Rechercher des annonces Classic Mini...",
      "button": "Rechercher"
    },
    "stats": {
      "activeListings": "annonces actives",
      "countries": "pays",
      "soldThisMonth": "vendus ce mois-ci",
      "newThisWeek": "nouveaux cette semaine"
    },
    "cta": {
      "title": "Prêt à publier quelque chose ?",
      "body": "Atteignez des passionnés de Classic Mini du monde entier. Publiez gratuitement ou passez Premium pour un placement en vedette et une priorité dans les résultats de recherche.",
      "listFree": "Publier gratuitement",
      "goPremium": "Passer Premium — 10 $"
    },
    "recent": {
      "heading": "Annonces récentes",
      "viewAll": "Tout voir",
      "emptyTitle": "Aucune annonce pour l'instant",
      "emptyBody": "Soyez le premier à publier !",
      "emptyAction": "Créer une annonce"
    },
    "features": {
      "heading": "Pourquoi The Mini Exchange ?",
      "worldwide": {
        "title": "Marché mondial",
        "body": "Achetez et vendez dans le monde entier avec 15 devises prises en charge. Les prix sont automatiquement convertis dans votre devise préférée."
      },
      "expertise": {
        "title": "Expertise Classic Mini",
        "body": "Créé par des passionnés. Plus de 50 champs spécifiques au Mini pour le suivi du patrimoine, des modifications et de l'authenticité."
      },
      "free": {
        "title": "Publication gratuite",
        "body": "Sans frais initiaux. Passez Premium pour 10 $ afin d'obtenir un placement en vedette, plus de photos et une priorité dans les résultats de recherche."
      },
      "photos": {
        "title": "Galeries de photos",
        "body": "Mettez en valeur chaque détail avec des catégories de photos organisées : carrosserie, moteur, intérieur et détails."
      },
      "heritage": {
        "title": "Documentation patrimoniale",
        "body": "Suivez les numéros VIN, les certificats patrimoniaux BMIHT, les couleurs d'origine et l'historique d'entretien."
      },
      "communication": {
        "title": "Communication directe",
        "body": "Messagerie intégrée et commentaires de questions-réponses publics pour le partage des connaissances communautaires."
      }
    }
  },
  "de": {
    "seo": {
      "title": "The Mini Exchange - Classic-Mini-Kleinanzeigen weltweit",
      "description": "Der Marktplatz für Classic Minis. Kaufe und verkaufe Fahrzeuge, Motoren und Teile aus der weltweiten Mini-Community.",
      "shareDescription": "Kaufe und verkaufe Classic-Mini-Fahrzeuge, Motoren und Teile von Enthusiasten weltweit.",
      "srHeading": "The Mini Exchange - Classic-Mini-Cooper-Kleinanzeigen weltweit"
    },
    "search": {
      "placeholder": "Classic-Mini-Anzeigen durchsuchen...",
      "button": "Suchen"
    },
    "stats": {
      "activeListings": "aktive Anzeigen",
      "countries": "Länder",
      "soldThisMonth": "diesen Monat verkauft",
      "newThisWeek": "neu diese Woche"
    },
    "cta": {
      "title": "Bereit, etwas zu inserieren?",
      "body": "Erreiche Classic-Mini-Enthusiasten weltweit. Inseriere kostenlos oder wechsle zu Premium für hervorgehobene Platzierung und Priorität in den Suchergebnissen.",
      "listFree": "Kostenlos inserieren",
      "goPremium": "Premium werden — 10 $"
    },
    "recent": {
      "heading": "Neueste Anzeigen",
      "viewAll": "Alle ansehen",
      "emptyTitle": "Noch keine Anzeigen",
      "emptyBody": "Sei der Erste, der etwas postet!",
      "emptyAction": "Anzeige erstellen"
    },
    "features": {
      "heading": "Warum The Mini Exchange?",
      "worldwide": {
        "title": "Weltweiter Marktplatz",
        "body": "Kaufe und verkaufe weltweit mit 15 unterstützten Währungen. Preise werden automatisch in deine bevorzugte Währung umgerechnet."
      },
      "expertise": {
        "title": "Classic-Mini-Expertise",
        "body": "Von Enthusiasten entwickelt. Über 50 Mini-spezifische Felder für Heritage-, Modifikations- und Authentizitätsverfolgung."
      },
      "free": {
        "title": "Kostenlos inserieren",
        "body": "Keine Vorabkosten. Wechsle für 10 $ zu Premium für hervorgehobene Platzierung, mehr Fotos und Priorität in den Suchergebnissen."
      },
      "photos": {
        "title": "Fotogalerien",
        "body": "Zeige jedes Detail mit organisierten Fotokategorien: Karosserie, Motor, Innenraum und Details."
      },
      "heritage": {
        "title": "Heritage-Dokumentation",
        "body": "Verfolge VIN-Nummern, BMIHT-Heritage-Zertifikate, Originalfarben und Wartungshistorie."
      },
      "communication": {
        "title": "Direkte Kommunikation",
        "body": "Integriertes Messaging plus öffentliche Q&A-Kommentare für den Wissensaustausch in der Community."
      }
    }
  },
  "it": {
    "seo": {
      "title": "The Mini Exchange - Annunci Classic Mini in tutto il mondo",
      "description": "Il mercato per le Classic Mini. Compra e vendi veicoli, motori e ricambi dalla comunità Mini mondiale.",
      "shareDescription": "Compra e vendi veicoli, motori e ricambi Classic Mini da appassionati di tutto il mondo.",
      "srHeading": "The Mini Exchange - Annunci Classic Mini Cooper in tutto il mondo"
    },
    "search": {
      "placeholder": "Cerca annunci Classic Mini...",
      "button": "Cerca"
    },
    "stats": {
      "activeListings": "annunci attivi",
      "countries": "paesi",
      "soldThisMonth": "venduti questo mese",
      "newThisWeek": "nuovi questa settimana"
    },
    "cta": {
      "title": "Pronto a pubblicare qualcosa?",
      "body": "Raggiungi gli appassionati di Classic Mini in tutto il mondo. Pubblica gratuitamente o passa a Premium per un posizionamento in evidenza e priorità nei risultati di ricerca.",
      "listFree": "Pubblica gratis",
      "goPremium": "Vai Premium — $10"
    },
    "recent": {
      "heading": "Annunci recenti",
      "viewAll": "Vedi tutto",
      "emptyTitle": "Ancora nessun annuncio",
      "emptyBody": "Sii il primo a pubblicare!",
      "emptyAction": "Crea un annuncio"
    },
    "features": {
      "heading": "Perché The Mini Exchange?",
      "worldwide": {
        "title": "Mercato mondiale",
        "body": "Compra e vendi in tutto il mondo con 15 valute supportate. I prezzi vengono convertiti automaticamente nella tua valuta preferita."
      },
      "expertise": {
        "title": "Competenza Classic Mini",
        "body": "Creato da appassionati. Oltre 50 campi specifici per il Mini per il tracciamento di heritage, modifiche e autenticità."
      },
      "free": {
        "title": "Pubblicazione gratuita",
        "body": "Nessun costo iniziale. Passa a Premium per $10 per ottenere posizionamento in evidenza, più foto e priorità nei risultati di ricerca."
      },
      "photos": {
        "title": "Gallerie fotografiche",
        "body": "Metti in risalto ogni dettaglio con categorie fotografiche organizzate: carrozzeria, motore, interni e dettagli."
      },
      "heritage": {
        "title": "Documentazione heritage",
        "body": "Traccia numeri VIN, certificati heritage BMIHT, colori originali e cronologia di manutenzione."
      },
      "communication": {
        "title": "Comunicazione diretta",
        "body": "Messaggistica integrata più commenti Q&A pubblici per la condivisione delle conoscenze della community."
      }
    }
  },
  "pt": {
    "seo": {
      "title": "The Mini Exchange - Anúncios de Classic Mini em todo o mundo",
      "description": "O mercado para Classic Minis. Compre e venda veículos, motores e peças da comunidade Mini mundial.",
      "shareDescription": "Compre e venda veículos, motores e peças Classic Mini de entusiastas de todo o mundo.",
      "srHeading": "The Mini Exchange - Anúncios de Classic Mini Cooper em todo o mundo"
    },
    "search": {
      "placeholder": "Pesquisar anúncios Classic Mini...",
      "button": "Pesquisar"
    },
    "stats": {
      "activeListings": "anúncios ativos",
      "countries": "países",
      "soldThisMonth": "vendidos este mês",
      "newThisWeek": "novos esta semana"
    },
    "cta": {
      "title": "Pronto para publicar algo?",
      "body": "Alcance entusiastas do Classic Mini em todo o mundo. Publique gratuitamente ou passe para o Premium para destaque e prioridade nos resultados de pesquisa.",
      "listFree": "Publicar gratuitamente",
      "goPremium": "Ir para Premium — $10"
    },
    "recent": {
      "heading": "Anúncios recentes",
      "viewAll": "Ver tudo",
      "emptyTitle": "Ainda não há anúncios",
      "emptyBody": "Seja o primeiro a publicar!",
      "emptyAction": "Criar um anúncio"
    },
    "features": {
      "heading": "Por que The Mini Exchange?",
      "worldwide": {
        "title": "Mercado mundial",
        "body": "Compre e venda em todo o mundo com 15 moedas suportadas. Os preços são convertidos automaticamente para a sua moeda preferida."
      },
      "expertise": {
        "title": "Experiência em Classic Mini",
        "body": "Criado por entusiastas. Mais de 50 campos específicos do Mini para rastreamento de herança, modificações e autenticidade."
      },
      "free": {
        "title": "Publicação gratuita",
        "body": "Sem custos iniciais. Vá para o Premium por $10 para obter posicionamento em destaque, mais fotos e prioridade nos resultados de pesquisa."
      },
      "photos": {
        "title": "Galerias de fotos",
        "body": "Mostre cada detalhe com categorias de fotos organizadas: carroceria, motor, interior e detalhes."
      },
      "heritage": {
        "title": "Documentação de herança",
        "body": "Rastreie números VIN, certificados de herança BMIHT, cores originais e histórico de manutenção."
      },
      "communication": {
        "title": "Comunicação direta",
        "body": "Mensagens integradas mais comentários públicos de perguntas e respostas para compartilhamento de conhecimento da comunidade."
      }
    }
  },
  "ru": {
    "seo": {
      "title": "The Mini Exchange - Объявления Classic Mini по всему миру",
      "description": "Торговая площадка для Classic Mini. Покупайте и продавайте автомобили, двигатели и запчасти от мирового сообщества Mini.",
      "shareDescription": "Покупайте и продавайте автомобили, двигатели и запчасти Classic Mini у энтузиастов со всего мира.",
      "srHeading": "The Mini Exchange - Объявления Classic Mini Cooper по всему миру"
    },
    "search": {
      "placeholder": "Поиск объявлений Classic Mini...",
      "button": "Поиск"
    },
    "stats": {
      "activeListings": "активных объявлений",
      "countries": "стран",
      "soldThisMonth": "продано в этом месяце",
      "newThisWeek": "новых на этой неделе"
    },
    "cta": {
      "title": "Готовы разместить объявление?",
      "body": "Достигайте энтузиастов Classic Mini по всему миру. Размещайте бесплатно или переходите на Premium для выделенного размещения и приоритета в результатах поиска.",
      "listFree": "Разместить бесплатно",
      "goPremium": "Перейти на Premium — $10"
    },
    "recent": {
      "heading": "Последние объявления",
      "viewAll": "Смотреть все",
      "emptyTitle": "Объявлений пока нет",
      "emptyBody": "Будьте первым, кто разместит!",
      "emptyAction": "Создать объявление"
    },
    "features": {
      "heading": "Почему The Mini Exchange?",
      "worldwide": {
        "title": "Мировой рынок",
        "body": "Покупайте и продавайте по всему миру с поддержкой 15 валют. Цены автоматически конвертируются в предпочитаемую валюту."
      },
      "expertise": {
        "title": "Экспертиза Classic Mini",
        "body": "Создано энтузиастами. Более 50 полей, специфичных для Mini, для отслеживания наследия, модификаций и аутентичности."
      },
      "free": {
        "title": "Бесплатное размещение",
        "body": "Без предварительных затрат. Перейдите на Premium за $10 для выделенного размещения, большего количества фото и приоритета в результатах поиска."
      },
      "photos": {
        "title": "Фотогалереи",
        "body": "Демонстрируйте каждую деталь с организованными категориями фото: кузов, двигатель, салон и детали."
      },
      "heritage": {
        "title": "Документация по наследию",
        "body": "Отслеживайте VIN-номера, сертификаты наследия BMIHT, оригинальные цвета и историю обслуживания."
      },
      "communication": {
        "title": "Прямая коммуникация",
        "body": "Встроенный мессенджер плюс публичные комментарии в формате вопрос-ответ для обмена знаниями в сообществе."
      }
    }
  },
  "ja": {
    "seo": {
      "title": "The Mini Exchange - 世界のクラシックミニ売買情報",
      "description": "クラシックミニのマーケットプレイス。世界中のMiniコミュニティから車両、エンジン、パーツを売買できます。",
      "shareDescription": "世界中の愛好家からクラシックミニの車両、エンジン、パーツを売買できます。",
      "srHeading": "The Mini Exchange - 世界のクラシックミニクーパー売買情報"
    },
    "search": {
      "placeholder": "クラシックミニの出品を検索...",
      "button": "検索"
    },
    "stats": {
      "activeListings": "件の出品中",
      "countries": "か国",
      "soldThisMonth": "件が今月売れた",
      "newThisWeek": "件が今週追加"
    },
    "cta": {
      "title": "出品しませんか？",
      "body": "世界中のクラシックミニ愛好家にリーチできます。無料で出品するか、プレミアムにアップグレードして注目の掲載枠と検索優先表示を手に入れましょう。",
      "listFree": "無料で出品",
      "goPremium": "プレミアムにする — $10"
    },
    "recent": {
      "heading": "最近の出品",
      "viewAll": "すべて見る",
      "emptyTitle": "まだ出品がありません",
      "emptyBody": "最初の出品者になりましょう！",
      "emptyAction": "出品を作成"
    },
    "features": {
      "heading": "なぜ The Mini Exchange？",
      "worldwide": {
        "title": "世界規模のマーケットプレイス",
        "body": "15の通貨をサポートし、世界中で売買できます。価格は自動的に希望の通貨に換算されます。"
      },
      "expertise": {
        "title": "クラシックミニの専門知識",
        "body": "愛好家が作成。ヘリテージ、改造、真正性追跡のためのMini固有フィールドが50以上。"
      },
      "free": {
        "title": "無料で出品",
        "body": "初期費用なし。$10でプレミアムにアップグレードすると、注目の掲載枠、より多くの写真、検索優先表示が得られます。"
      },
      "photos": {
        "title": "フォトギャラリー",
        "body": "ボディ、エンジン、インテリア、ディテールなど整理されたカテゴリで細部まで紹介できます。"
      },
      "heritage": {
        "title": "ヘリテージドキュメント",
        "body": "VIN番号、BMIHTヘリテージ証明書、オリジナルカラー、整備履歴を記録できます。"
      },
      "communication": {
        "title": "直接コミュニケーション",
        "body": "組み込みメッセージングとコミュニティの知識共有のための公開Q&Aコメント。"
      }
    }
  },
  "zh": {
    "seo": {
      "title": "The Mini Exchange - 全球经典 Mini 分类广告",
      "description": "经典 Mini 的交易市场。来自全球 Mini 社区的车辆、发动机和零件买卖平台。",
      "shareDescription": "与全球各地的爱好者买卖经典 Mini 车辆、发动机和零件。",
      "srHeading": "The Mini Exchange - 全球经典 Mini Cooper 分类广告"
    },
    "search": {
      "placeholder": "搜索经典 Mini 刊登...",
      "button": "搜索"
    },
    "stats": {
      "activeListings": "条活跃刊登",
      "countries": "个国家",
      "soldThisMonth": "本月已售",
      "newThisWeek": "本周新增"
    },
    "cta": {
      "title": "准备好发布了吗？",
      "body": "触达全球经典 Mini 爱好者。免费发布，或升级 Premium 以获得特色展示位和搜索结果优先排名。",
      "listFree": "免费发布",
      "goPremium": "升级 Premium — $10"
    },
    "recent": {
      "heading": "最新刊登",
      "viewAll": "查看全部",
      "emptyTitle": "暂无刊登",
      "emptyBody": "来发布第一个吧！",
      "emptyAction": "创建刊登"
    },
    "features": {
      "heading": "为什么选择 The Mini Exchange？",
      "worldwide": {
        "title": "全球市场",
        "body": "支持 15 种货币，在全球范围内买卖。价格自动换算为您的首选货币。"
      },
      "expertise": {
        "title": "经典 Mini 专业知识",
        "body": "由爱好者打造。超过 50 个 Mini 专属字段，用于跟踪传承、改装和真实性。"
      },
      "free": {
        "title": "免费发布",
        "body": "无需预付费用。升级 Premium 仅需 $10，即可获得特色展示位、更多图片和搜索优先排名。"
      },
      "photos": {
        "title": "照片库",
        "body": "通过有序分类（车身、发动机、内饰、细节）展示每个细节。"
      },
      "heritage": {
        "title": "传承文件",
        "body": "追踪 VIN 编号、BMIHT 传承证书、原厂颜色和维修历史。"
      },
      "communication": {
        "title": "直接沟通",
        "body": "内置消息功能加上公开问答评论，促进社区知识共享。"
      }
    }
  },
  "ko": {
    "seo": {
      "title": "The Mini Exchange - 전 세계 클래식 미니 분류 광고",
      "description": "클래식 미니를 위한 마켓플레이스. 전 세계 미니 커뮤니티에서 차량, 엔진, 부품을 사고파세요.",
      "shareDescription": "전 세계 애호가들과 함께 클래식 미니 차량, 엔진, 부품을 사고파세요.",
      "srHeading": "The Mini Exchange - 전 세계 클래식 미니 쿠퍼 분류 광고"
    },
    "search": {
      "placeholder": "클래식 미니 매물 검색...",
      "button": "검색"
    },
    "stats": {
      "activeListings": "개 활성 매물",
      "countries": "개국",
      "soldThisMonth": "건 이번 달 판매됨",
      "newThisWeek": "건 이번 주 신규"
    },
    "cta": {
      "title": "무언가 등록할 준비가 되셨나요?",
      "body": "전 세계 클래식 미니 애호가에게 다가가세요. 무료로 등록하거나 Premium으로 업그레이드하여 추천 배치와 검색 결과 우선 노출 혜택을 받으세요.",
      "listFree": "무료로 등록",
      "goPremium": "Premium 이용하기 — $10"
    },
    "recent": {
      "heading": "최근 매물",
      "viewAll": "전체 보기",
      "emptyTitle": "아직 매물이 없습니다",
      "emptyBody": "첫 번째로 등록해 보세요!",
      "emptyAction": "매물 등록하기"
    },
    "features": {
      "heading": "왜 The Mini Exchange인가요?",
      "worldwide": {
        "title": "전 세계 마켓플레이스",
        "body": "15개 통화를 지원하여 전 세계에서 사고팔 수 있습니다. 가격은 선호하는 통화로 자동 변환됩니다."
      },
      "expertise": {
        "title": "클래식 미니 전문성",
        "body": "애호가가 만들었습니다. 헤리티지, 개조, 정통성 추적을 위한 Mini 전용 필드 50개 이상."
      },
      "free": {
        "title": "무료 등록",
        "body": "선불 비용 없음. $10에 Premium으로 업그레이드하면 추천 배치, 더 많은 사진, 검색 결과 우선 노출을 받습니다."
      },
      "photos": {
        "title": "사진 갤러리",
        "body": "차체, 엔진, 인테리어, 세부 사항 등 정리된 사진 카테고리로 모든 세부 사항을 보여주세요."
      },
      "heritage": {
        "title": "헤리티지 문서화",
        "body": "VIN 번호, BMIHT 헤리티지 인증서, 원래 색상 및 정비 이력을 추적하세요."
      },
      "communication": {
        "title": "직접 소통",
        "body": "내장 메시지 기능과 커뮤니티 지식 공유를 위한 공개 Q&A 댓글."
      }
    }
  }
}
</i18n>
