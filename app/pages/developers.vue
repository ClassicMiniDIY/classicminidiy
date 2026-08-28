<script lang="ts" setup>
  import { FREE_TOOLS, PAID_ONLY_TOOLS } from '~~/server/utils/mcpTiers';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { add: addToast } = useToast();
  const { isAuthenticated, user, waitForAuth } = useAuth();
  const { subscription, fetchSubscription, refreshEntitlement } = useDeveloperKeys();

  const MCP_ENDPOINT = 'https://classicminidiy.com/mcp';
  const DOCS_URL = 'https://github.com/SomethingNew71/classicminidiy/blob/main/server/mcp/README.md';

  // The pricing table renders the SAME lists the tiering plugin enforces —
  // imported from server/utils/mcpTiers so page and gate cannot drift.
  const freeTools = [...FREE_TOOLS].sort();
  const paidTools = [...PAID_ONLY_TOOLS].sort();
  const allTools = [...freeTools, ...paidTools];

  const authReady = ref(false);
  const checkoutLoading = ref(false);
  const interval = ref<'month' | 'year'>('month');

  const isSubscribed = computed(() => subscription.value?.is_active === true);

  // Logged-out subscribe intent (same D1 pattern as /membership): route through
  // sign-in with the intent + chosen interval preserved, auto-start checkout on
  // return (see onMounted).
  const loginWithIntentHref = computed(
    () => `/login?redirect=${encodeURIComponent(`/developers?subscribe=1&interval=${interval.value}`)}`
  );

  // Post-checkout activation poll, shared loop with /membership
  // (useSubscriptionPolling). The developer check reads get_my_subscription via
  // useDeveloperKeys; on activation, purge the worker's key-auth cache so keys
  // minted on the free tier upgrade instantly instead of after the cache TTL.
  const { activationState, pollActivation } = useSubscriptionPolling(async () => {
    if (!user.value) return 'abort';
    await fetchSubscription();
    if (subscription.value?.is_active) {
      refreshEntitlement();
      return 'active';
    }
    return 'pending';
  });

  const showPriceCard = computed(() => authReady.value && !isSubscribed.value && activationState.value === 'idle');

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function subscribe() {
    if (!isAuthenticated.value) {
      navigateTo(loginWithIntentHref.value);
      return;
    }
    checkoutLoading.value = true;
    track('developer_checkout_started', { source: 'web', interval: interval.value });
    try {
      const token = await getAccessToken();
      if (!token) {
        navigateTo(loginWithIntentHref.value);
        return;
      }
      const res = await $fetch<{ url?: string }>('/api/developer/checkout', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { interval: interval.value },
      });
      if (!res?.url) throw new Error('Missing checkout URL');
      await navigateTo(res.url, { external: true });
    } catch (error) {
      console.error('Developer API checkout failed:', error);
      addToast({
        title: t('errors.checkout_title'),
        description: t('errors.checkout_body'),
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      checkoutLoading.value = false;
    }
  }

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(MCP_ENDPOINT);
      addToast({ title: t('copied'), color: 'success', icon: 'fas fa-circle-check' });
    } catch {
      addToast({ title: t('copy_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    }
  };

  onMounted(async () => {
    await waitForAuth();
    if (isAuthenticated.value) {
      await fetchSubscription();
    }
    authReady.value = true;

    // Stripe returns with ?subscribed=1 / ?canceled=1; sign-in returns with
    // ?subscribe=1&interval=… (preserved intent). Process once, then strip the
    // params so a refresh doesn't replay the toast / checkout.
    if (route.query.subscribed || route.query.canceled || route.query.subscribe) {
      if (route.query.interval === 'year' || route.query.interval === 'month') {
        interval.value = route.query.interval;
      }
      if (route.query.subscribed) {
        track('developer_checkout_succeeded', { source: 'web' });
        addToast({
          title: t('toasts.subscribed_title'),
          description: t('toasts.subscribed_body'),
          color: 'success',
          icon: 'fas fa-circle-check',
          timeout: 8000,
        });
        if (user.value && !isSubscribed.value) pollActivation();
      } else if (route.query.canceled) {
        addToast({
          title: t('toasts.canceled_title'),
          description: t('toasts.canceled_body'),
          color: 'info',
          icon: 'fas fa-circle-info',
        });
      }
      const shouldAutoSubscribe =
        route.query.subscribe === '1' &&
        !route.query.subscribed &&
        !route.query.canceled &&
        isAuthenticated.value &&
        !isSubscribed.value;
      const {
        subscribed: _subscribed,
        canceled: _canceled,
        subscribe: _subscribe,
        interval: _interval,
        ...rest
      } = route.query;
      router.replace({ query: rest });
      if (shouldAutoSubscribe) subscribe();
    }
  });

  useHead({
    title: t('meta.title'),
    meta: [
      { name: 'description', content: t('meta.description') },
      { property: 'og:title', content: t('meta.title') },
      { property: 'og:description', content: t('meta.description') },
    ],
  });
</script>

<template>
  <div class="developers-page">
    <!-- Hero -->
    <section class="hero bg-base-200 border-b border-base-300">
      <div class="hero-content text-center py-14">
        <div class="max-w-2xl">
          <span class="eyebrow"><i class="fas fa-code mr-1 text-primary"></i>{{ t('hero.eyebrow') }}</span>
          <h1 class="text-4xl sm:text-5xl font-bold pt-2 pb-4">{{ t('hero.title') }}</h1>
          <p class="text-lg opacity-80">{{ t('hero.subtitle') }}</p>
          <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
            <code class="bg-base-100 border border-base-300 rounded-box px-3 py-2 text-sm">{{ MCP_ENDPOINT }}</code>
            <button type="button" class="btn btn-sm" @click="copyEndpoint">
              <i class="fas fa-copy" aria-hidden="true"></i>
              {{ t('copy') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="container mx-auto px-4 py-12 max-w-4xl space-y-12">
      <!-- What it is -->
      <section>
        <p class="eyebrow text-center"><i class="fas fa-plug mr-1"></i>{{ t('about.eyebrow') }}</p>
        <h2 class="text-3xl font-bold text-center pt-2 pb-8">{{ t('about.title') }}</h2>
        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <li class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-5 flex-row items-start gap-4">
              <span class="text-2xl text-primary shrink-0 mt-1"><i class="fas fa-fingerprint"></i></span>
              <div>
                <h3 class="font-bold">{{ t('about.items.decoders.title') }}</h3>
                <p class="text-sm opacity-70 mt-1">{{ t('about.items.decoders.desc') }}</p>
              </div>
            </div>
          </li>
          <li class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-5 flex-row items-start gap-4">
              <span class="text-2xl text-primary shrink-0 mt-1"><i class="fas fa-box-archive"></i></span>
              <div>
                <h3 class="font-bold">{{ t('about.items.archive.title') }}</h3>
                <p class="text-sm opacity-70 mt-1">{{ t('about.items.archive.desc') }}</p>
              </div>
            </div>
          </li>
          <li class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-5 flex-row items-start gap-4">
              <span class="text-2xl text-primary shrink-0 mt-1"><i class="fas fa-gauge-high"></i></span>
              <div>
                <h3 class="font-bold">{{ t('about.items.limits.title') }}</h3>
                <p class="text-sm opacity-70 mt-1">{{ t('about.items.limits.desc') }}</p>
              </div>
            </div>
          </li>
          <li class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-5 flex-row items-start gap-4">
              <span class="text-2xl text-primary shrink-0 mt-1"><i class="fas fa-key"></i></span>
              <div>
                <h3 class="font-bold">{{ t('about.items.keys.title') }}</h3>
                <p class="text-sm opacity-70 mt-1">{{ t('about.items.keys.desc') }}</p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Tool matrix: rendered from the same constants the gate enforces -->
      <section>
        <p class="eyebrow text-center"><i class="fas fa-screwdriver-wrench mr-1"></i>{{ t('tools.eyebrow') }}</p>
        <h2 class="text-3xl font-bold text-center pt-2 pb-2">{{ t('tools.title') }}</h2>
        <p class="text-center opacity-70 pb-8">{{ t('tools.subtitle') }}</p>
        <div class="max-w-full overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>{{ t('tools.col_tool') }}</th>
                <th class="text-center">{{ t('tools.col_free') }}</th>
                <th class="text-center">{{ t('tools.col_developer') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tool in allTools" :key="tool">
                <td><code>{{ tool }}</code></td>
                <td class="text-center">
                  <i v-if="FREE_TOOLS.has(tool)" class="fas fa-circle-check text-success" aria-hidden="true"></i>
                  <i v-else class="fas fa-circle-xmark opacity-30" aria-hidden="true"></i>
                  <span class="sr-only">{{ FREE_TOOLS.has(tool) ? t('tools.included') : t('tools.not_included') }}</span>
                </td>
                <td class="text-center">
                  <i class="fas fa-circle-check text-success" aria-hidden="true"></i>
                  <span class="sr-only">{{ t('tools.included') }}</span>
                </td>
              </tr>
              <tr class="bg-base-200">
                <td class="font-semibold">{{ t('tools.rate_limit') }}</td>
                <td class="text-center text-sm">{{ t('tools.rate_free') }}</td>
                <td class="text-center text-sm font-semibold">{{ t('tools.rate_developer') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-center text-sm opacity-60 mt-3">
          {{ t('tools.free_note') }}
          <a :href="DOCS_URL" target="_blank" rel="noopener" class="link link-primary">{{ t('tools.docs_cta') }}</a>
        </p>
      </section>

      <!-- Pricing + CTA (client-reactive on auth + subscription state) -->
      <ClientOnly>
        <section v-if="!authReady" class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
            <p class="opacity-60 mt-3">{{ t('cta.checking') }}</p>
          </div>
        </section>

        <!-- Active subscriber -->
        <section v-else-if="isSubscribed" class="card bg-base-100 border border-primary/40 shadow-md">
          <div class="card-body items-center text-center">
            <span class="badge badge-primary badge-lg gap-1"><i class="fas fa-code"></i>{{ t('subscriber.badge') }}</span>
            <h2 class="text-2xl font-bold mt-2">{{ t('subscriber.title') }}</h2>
            <p class="opacity-70 max-w-lg">{{ t('subscriber.subtitle') }}</p>
            <div class="card-actions mt-4">
              <NuxtLink to="/dashboard/api-keys" class="btn btn-primary">
                <i class="fas fa-key" aria-hidden="true"></i>
                {{ t('subscriber.manage_keys') }}
              </NuxtLink>
            </div>
          </div>
        </section>

        <!-- Post-checkout webhook race window -->
        <section v-else-if="activationState === 'polling'" class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center py-12">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <h2 class="text-xl font-bold mt-3">{{ t('cta.activating_title') }}</h2>
            <p class="opacity-60 max-w-lg">{{ t('cta.activating_body') }}</p>
          </div>
        </section>

        <section v-else-if="activationState === 'timeout'" class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center py-12">
            <i class="fas fa-hourglass-half text-3xl text-warning"></i>
            <h2 class="text-xl font-bold mt-3">{{ t('cta.activation_timeout_title') }}</h2>
            <p class="opacity-60 max-w-lg">{{ t('cta.activation_timeout_body') }}</p>
          </div>
        </section>

        <!-- Non-subscriber / logged-out -->
        <section v-else class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center">
            <h2 class="text-2xl font-bold">{{ t('cta.title') }}</h2>
            <p class="opacity-70 max-w-lg">{{ t('cta.subtitle') }}</p>

            <div v-if="showPriceCard" class="join mt-4">
              <input
                v-model="interval"
                class="join-item btn btn-sm"
                type="radio"
                name="billing-interval"
                value="month"
                :aria-label="t('pricing.monthly')"
              />
              <input
                v-model="interval"
                class="join-item btn btn-sm"
                type="radio"
                name="billing-interval"
                value="year"
                :aria-label="t('pricing.yearly')"
              />
            </div>

            <div v-if="showPriceCard" class="mt-2">
              <p class="text-4xl font-bold">
                {{ interval === 'year' ? t('pricing.price_yearly') : t('pricing.price_monthly') }}
              </p>
              <p class="text-sm opacity-70 mt-1">
                <template v-if="interval === 'year'">
                  {{ t('pricing.yearly_note') }}
                  <span class="badge badge-success badge-sm ml-1">{{ t('pricing.save') }}</span>
                </template>
                <template v-else>{{ t('pricing.monthly_note') }}</template>
              </p>
            </div>

            <div class="card-actions mt-4">
              <button type="button" class="btn btn-primary btn-lg" :disabled="checkoutLoading" @click="subscribe">
                <span v-if="checkoutLoading" class="loading loading-spinner loading-sm"></span>
                <i v-else class="fas fa-bolt" aria-hidden="true"></i>
                {{ isAuthenticated ? t('cta.subscribe') : t('cta.sign_in_subscribe') }}
              </button>
            </div>

            <p class="text-sm opacity-60 mt-3">
              {{ t('cta.free_tier_note') }}
              <NuxtLink to="/dashboard/api-keys" class="link link-primary">{{ t('cta.free_tier_cta') }}</NuxtLink>
            </p>
          </div>
        </section>
      </ClientOnly>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Developer API - Classic Mini DIY",
      "description": "Bring the Classic Mini DIY calculators, decoders, and archive into your AI tools over MCP. Free tier for the calculators; $4.99/month unlocks everything."
    },
    "hero": {
      "eyebrow": "DEVELOPER API",
      "title": "The Classic Mini, in your AI tools",
      "subtitle": "One MCP endpoint puts the CMDIY calculators, chassis and engine decoders, and the wheel and color archives inside Claude, Cursor, and any MCP client."
    },
    "copy": "Copy",
    "copied": "Copied to clipboard.",
    "copy_error": "Could not copy. Select the text and copy it manually.",
    "about": {
      "eyebrow": "WHAT YOU GET",
      "title": "Built for tinkerers and toolmakers",
      "items": {
        "decoders": {
          "title": "Identification decoders",
          "desc": "Decode chassis and engine numbers across every era, straight from your AI client."
        },
        "archive": {
          "title": "Archive data",
          "desc": "Query the community wheel and paint color archives — decades of documented Minis."
        },
        "limits": {
          "title": "12x the rate limit",
          "desc": "240 requests per minute per key, against 20 on the free tier."
        },
        "keys": {
          "title": "Self-serve keys",
          "desc": "Mint, name, and revoke up to 5 API keys, with per-tool usage charts in your dashboard."
        }
      }
    },
    "tools": {
      "eyebrow": "TOOLS",
      "title": "Every tool, both tiers",
      "subtitle": "The free tier covers the calculators and reference tables. Developer unlocks the decoders and archives.",
      "col_tool": "Tool",
      "col_free": "Free",
      "col_developer": "Developer",
      "included": "Included",
      "not_included": "Not included",
      "rate_limit": "Rate limit",
      "rate_free": "20 requests/min",
      "rate_developer": "240 requests/min",
      "free_note": "Tool identifiers are the MCP tool names.",
      "docs_cta": "Read the API docs"
    },
    "pricing": {
      "monthly": "Monthly",
      "yearly": "Yearly",
      "price_monthly": "$4.99/mo",
      "price_yearly": "$47.90/yr",
      "monthly_note": "Cancel anytime.",
      "yearly_note": "That is $3.99/month.",
      "save": "Save 20%"
    },
    "cta": {
      "checking": "Checking your account…",
      "title": "Unlock the full toolset",
      "subtitle": "Subscribe once, and every key on your account gets all 11 tools and the higher rate limit.",
      "subscribe": "Subscribe",
      "sign_in_subscribe": "Sign in to subscribe",
      "free_tier_note": "Just want the calculators?",
      "free_tier_cta": "Mint a free key",
      "activating_title": "Activating your subscription…",
      "activating_body": "Payment received. We are unlocking your account — this usually takes a few seconds.",
      "activation_timeout_title": "Almost there",
      "activation_timeout_body": "Your payment went through, but activation is taking longer than usual. Refresh this page in a minute — no action needed."
    },
    "subscriber": {
      "badge": "Developer",
      "title": "You have the full toolset",
      "subtitle": "All 11 tools and the 240/min limit are active on every key you hold.",
      "manage_keys": "Manage API keys"
    },
    "toasts": {
      "subscribed_title": "Welcome aboard!",
      "subscribed_body": "Your Developer API subscription is processing.",
      "canceled_title": "Checkout canceled",
      "canceled_body": "No charge was made. Subscribe whenever you are ready."
    },
    "errors": {
      "checkout_title": "Checkout failed",
      "checkout_body": "We could not start checkout. Please try again in a moment."
    }
  },
  "es": {
    "meta": {
      "title": "API para desarrolladores - Classic Mini DIY",
      "description": "Lleva las calculadoras, los decodificadores y el archivo de Classic Mini DIY a tus herramientas de IA mediante MCP. Nivel gratuito para las calculadoras; 4,99 $/mes desbloquea todo."
    },
    "hero": {
      "eyebrow": "API PARA DESARROLLADORES",
      "title": "El Classic Mini, en tus herramientas de IA",
      "subtitle": "Un endpoint MCP pone las calculadoras CMDIY, los decodificadores de chasis y motor y los archivos de ruedas y colores dentro de Claude, Cursor y cualquier cliente MCP."
    },
    "copy": "Copiar",
    "copied": "Copiado al portapapeles.",
    "copy_error": "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
    "about": {
      "eyebrow": "QUÉ OBTIENES",
      "title": "Hecho para aficionados y creadores de herramientas",
      "items": {
        "decoders": {
          "title": "Decodificadores de identificación",
          "desc": "Decodifica números de chasis y motor de todas las épocas, directamente desde tu cliente de IA."
        },
        "archive": {
          "title": "Datos de archivo",
          "desc": "Consulta los archivos comunitarios de ruedas y colores de pintura: décadas de Minis documentados."
        },
        "limits": {
          "title": "12 veces más límite",
          "desc": "240 solicitudes por minuto por clave, frente a 20 en el nivel gratuito."
        },
        "keys": {
          "title": "Claves autoservicio",
          "desc": "Crea, nombra y revoca hasta 5 claves de API, con gráficos de uso por herramienta en tu panel."
        }
      }
    },
    "tools": {
      "eyebrow": "HERRAMIENTAS",
      "title": "Todas las herramientas, ambos niveles",
      "subtitle": "El nivel gratuito cubre las calculadoras y tablas de referencia. Desarrollador desbloquea los decodificadores y archivos.",
      "col_tool": "Herramienta",
      "col_free": "Gratis",
      "col_developer": "Desarrollador",
      "included": "Incluida",
      "not_included": "No incluida",
      "rate_limit": "Límite de solicitudes",
      "rate_free": "20 solicitudes/min",
      "rate_developer": "240 solicitudes/min",
      "free_note": "Los identificadores son los nombres de herramientas MCP.",
      "docs_cta": "Leer la documentación de la API"
    },
    "pricing": {
      "monthly": "Mensual",
      "yearly": "Anual",
      "price_monthly": "4,99 $/mes",
      "price_yearly": "47,90 $/año",
      "monthly_note": "Cancela cuando quieras.",
      "yearly_note": "Equivale a 3,99 $/mes.",
      "save": "Ahorra 20%"
    },
    "cta": {
      "checking": "Comprobando tu cuenta…",
      "title": "Desbloquea todas las herramientas",
      "subtitle": "Suscríbete una vez y cada clave de tu cuenta tendrá las 11 herramientas y el límite superior.",
      "subscribe": "Suscribirse",
      "sign_in_subscribe": "Inicia sesión para suscribirte",
      "free_tier_note": "¿Solo quieres las calculadoras?",
      "free_tier_cta": "Crea una clave gratis",
      "activating_title": "Activando tu suscripción…",
      "activating_body": "Pago recibido. Estamos desbloqueando tu cuenta; suele tardar unos segundos.",
      "activation_timeout_title": "Casi listo",
      "activation_timeout_body": "Tu pago se realizó, pero la activación tarda más de lo habitual. Actualiza esta página en un minuto; no necesitas hacer nada."
    },
    "subscriber": {
      "badge": "Desarrollador",
      "title": "Tienes todas las herramientas",
      "subtitle": "Las 11 herramientas y el límite de 240/min están activos en todas tus claves.",
      "manage_keys": "Gestionar claves de API"
    },
    "toasts": {
      "subscribed_title": "¡Bienvenido!",
      "subscribed_body": "Tu suscripción a la API para desarrolladores se está procesando.",
      "canceled_title": "Pago cancelado",
      "canceled_body": "No se realizó ningún cargo. Suscríbete cuando quieras."
    },
    "errors": {
      "checkout_title": "Error en el pago",
      "checkout_body": "No pudimos iniciar el pago. Inténtalo de nuevo en un momento."
    }
  },
  "fr": {
    "meta": {
      "title": "API développeur - Classic Mini DIY",
      "description": "Amenez les calculateurs, décodeurs et archives de Classic Mini DIY dans vos outils d'IA via MCP. Offre gratuite pour les calculateurs ; 4,99 $/mois débloque tout."
    },
    "hero": {
      "eyebrow": "API DÉVELOPPEUR",
      "title": "La Classic Mini, dans vos outils d'IA",
      "subtitle": "Un endpoint MCP met les calculateurs CMDIY, les décodeurs de châssis et de moteur et les archives de roues et de couleurs dans Claude, Cursor et tout client MCP."
    },
    "copy": "Copier",
    "copied": "Copié dans le presse-papiers.",
    "copy_error": "Copie impossible. Sélectionnez le texte et copiez-le manuellement.",
    "about": {
      "eyebrow": "CE QUE VOUS OBTENEZ",
      "title": "Conçu pour les passionnés et les créateurs d'outils",
      "items": {
        "decoders": {
          "title": "Décodeurs d'identification",
          "desc": "Décodez les numéros de châssis et de moteur de toutes les époques, depuis votre client d'IA."
        },
        "archive": {
          "title": "Données d'archives",
          "desc": "Interrogez les archives communautaires de roues et de couleurs — des décennies de Minis documentées."
        },
        "limits": {
          "title": "Limite multipliée par 12",
          "desc": "240 requêtes par minute et par clé, contre 20 pour l'offre gratuite."
        },
        "keys": {
          "title": "Clés en libre-service",
          "desc": "Créez, nommez et révoquez jusqu'à 5 clés d'API, avec des graphiques d'utilisation par outil dans votre tableau de bord."
        }
      }
    },
    "tools": {
      "eyebrow": "OUTILS",
      "title": "Tous les outils, les deux offres",
      "subtitle": "L'offre gratuite couvre les calculateurs et les tables de référence. Développeur débloque les décodeurs et les archives.",
      "col_tool": "Outil",
      "col_free": "Gratuit",
      "col_developer": "Développeur",
      "included": "Inclus",
      "not_included": "Non inclus",
      "rate_limit": "Limite de requêtes",
      "rate_free": "20 requêtes/min",
      "rate_developer": "240 requêtes/min",
      "free_note": "Les identifiants sont les noms d'outils MCP.",
      "docs_cta": "Lire la documentation de l'API"
    },
    "pricing": {
      "monthly": "Mensuel",
      "yearly": "Annuel",
      "price_monthly": "4,99 $/mois",
      "price_yearly": "47,90 $/an",
      "monthly_note": "Annulez à tout moment.",
      "yearly_note": "Soit 3,99 $/mois.",
      "save": "-20 %"
    },
    "cta": {
      "checking": "Vérification de votre compte…",
      "title": "Débloquez l'ensemble des outils",
      "subtitle": "Abonnez-vous une fois, et chaque clé de votre compte obtient les 11 outils et la limite supérieure.",
      "subscribe": "S'abonner",
      "sign_in_subscribe": "Connectez-vous pour vous abonner",
      "free_tier_note": "Vous ne voulez que les calculateurs ?",
      "free_tier_cta": "Créez une clé gratuite",
      "activating_title": "Activation de votre abonnement…",
      "activating_body": "Paiement reçu. Nous débloquons votre compte — cela prend généralement quelques secondes.",
      "activation_timeout_title": "Presque terminé",
      "activation_timeout_body": "Votre paiement a été effectué, mais l'activation prend plus de temps que d'habitude. Actualisez cette page dans une minute — aucune action nécessaire."
    },
    "subscriber": {
      "badge": "Développeur",
      "title": "Vous avez tous les outils",
      "subtitle": "Les 11 outils et la limite de 240/min sont actifs sur chacune de vos clés.",
      "manage_keys": "Gérer les clés d'API"
    },
    "toasts": {
      "subscribed_title": "Bienvenue !",
      "subscribed_body": "Votre abonnement à l'API développeur est en cours de traitement.",
      "canceled_title": "Paiement annulé",
      "canceled_body": "Aucun débit n'a été effectué. Abonnez-vous quand vous voulez."
    },
    "errors": {
      "checkout_title": "Échec du paiement",
      "checkout_body": "Impossible de démarrer le paiement. Réessayez dans un instant."
    }
  },
  "de": {
    "meta": {
      "title": "Entwickler-API - Classic Mini DIY",
      "description": "Holen Sie die Rechner, Decoder und Archive von Classic Mini DIY per MCP in Ihre KI-Tools. Kostenlose Stufe für die Rechner; 4,99 $/Monat schaltet alles frei."
    },
    "hero": {
      "eyebrow": "ENTWICKLER-API",
      "title": "Der Classic Mini, in Ihren KI-Tools",
      "subtitle": "Ein MCP-Endpunkt bringt die CMDIY-Rechner, die Fahrgestell- und Motor-Decoder sowie die Felgen- und Farbarchive in Claude, Cursor und jeden MCP-Client."
    },
    "copy": "Kopieren",
    "copied": "In die Zwischenablage kopiert.",
    "copy_error": "Kopieren nicht möglich. Markieren Sie den Text und kopieren Sie ihn manuell.",
    "about": {
      "eyebrow": "WAS SIE BEKOMMEN",
      "title": "Gebaut für Schrauber und Toolbauer",
      "items": {
        "decoders": {
          "title": "Identifikations-Decoder",
          "desc": "Dekodieren Sie Fahrgestell- und Motornummern aller Epochen, direkt aus Ihrem KI-Client."
        },
        "archive": {
          "title": "Archivdaten",
          "desc": "Fragen Sie die Community-Archive für Felgen und Lackfarben ab — Jahrzehnte dokumentierter Minis."
        },
        "limits": {
          "title": "12-faches Limit",
          "desc": "240 Anfragen pro Minute und Schlüssel, gegenüber 20 in der kostenlosen Stufe."
        },
        "keys": {
          "title": "Self-Service-Schlüssel",
          "desc": "Erstellen, benennen und widerrufen Sie bis zu 5 API-Schlüssel, mit Nutzungsdiagrammen pro Tool im Dashboard."
        }
      }
    },
    "tools": {
      "eyebrow": "TOOLS",
      "title": "Jedes Tool, beide Stufen",
      "subtitle": "Die kostenlose Stufe umfasst die Rechner und Referenztabellen. Entwickler schaltet die Decoder und Archive frei.",
      "col_tool": "Tool",
      "col_free": "Kostenlos",
      "col_developer": "Entwickler",
      "included": "Enthalten",
      "not_included": "Nicht enthalten",
      "rate_limit": "Anfragelimit",
      "rate_free": "20 Anfragen/Min",
      "rate_developer": "240 Anfragen/Min",
      "free_note": "Die Bezeichner sind die MCP-Toolnamen.",
      "docs_cta": "API-Dokumentation lesen"
    },
    "pricing": {
      "monthly": "Monatlich",
      "yearly": "Jährlich",
      "price_monthly": "4,99 $/Monat",
      "price_yearly": "47,90 $/Jahr",
      "monthly_note": "Jederzeit kündbar.",
      "yearly_note": "Das sind 3,99 $/Monat.",
      "save": "20 % sparen"
    },
    "cta": {
      "checking": "Konto wird geprüft…",
      "title": "Schalten Sie alle Tools frei",
      "subtitle": "Einmal abonnieren, und jeder Schlüssel Ihres Kontos erhält alle 11 Tools und das höhere Limit.",
      "subscribe": "Abonnieren",
      "sign_in_subscribe": "Anmelden und abonnieren",
      "free_tier_note": "Nur die Rechner gewünscht?",
      "free_tier_cta": "Kostenlosen Schlüssel erstellen",
      "activating_title": "Abonnement wird aktiviert…",
      "activating_body": "Zahlung erhalten. Wir schalten Ihr Konto frei — das dauert meist nur wenige Sekunden.",
      "activation_timeout_title": "Fast geschafft",
      "activation_timeout_body": "Ihre Zahlung war erfolgreich, aber die Aktivierung dauert länger als üblich. Aktualisieren Sie die Seite in einer Minute — keine Aktion nötig."
    },
    "subscriber": {
      "badge": "Entwickler",
      "title": "Sie haben alle Tools",
      "subtitle": "Alle 11 Tools und das 240/Min-Limit sind auf jedem Ihrer Schlüssel aktiv.",
      "manage_keys": "API-Schlüssel verwalten"
    },
    "toasts": {
      "subscribed_title": "Willkommen an Bord!",
      "subscribed_body": "Ihr Entwickler-API-Abonnement wird verarbeitet.",
      "canceled_title": "Kauf abgebrochen",
      "canceled_body": "Es wurde nichts abgebucht. Abonnieren Sie, wann immer Sie bereit sind."
    },
    "errors": {
      "checkout_title": "Kauf fehlgeschlagen",
      "checkout_body": "Der Kauf konnte nicht gestartet werden. Bitte versuchen Sie es gleich erneut."
    }
  },
  "it": {
    "meta": {
      "title": "API per sviluppatori - Classic Mini DIY",
      "description": "Porta i calcolatori, i decodificatori e l'archivio di Classic Mini DIY nei tuoi strumenti di IA tramite MCP. Livello gratuito per i calcolatori; 4,99 $/mese sblocca tutto."
    },
    "hero": {
      "eyebrow": "API PER SVILUPPATORI",
      "title": "La Classic Mini, nei tuoi strumenti di IA",
      "subtitle": "Un endpoint MCP porta i calcolatori CMDIY, i decodificatori di telaio e motore e gli archivi di ruote e colori dentro Claude, Cursor e qualsiasi client MCP."
    },
    "copy": "Copia",
    "copied": "Copiato negli appunti.",
    "copy_error": "Impossibile copiare. Seleziona il testo e copialo manualmente.",
    "about": {
      "eyebrow": "COSA OTTIENI",
      "title": "Fatto per appassionati e creatori di strumenti",
      "items": {
        "decoders": {
          "title": "Decodificatori di identificazione",
          "desc": "Decodifica i numeri di telaio e motore di ogni epoca, direttamente dal tuo client di IA."
        },
        "archive": {
          "title": "Dati d'archivio",
          "desc": "Interroga gli archivi comunitari di ruote e colori — decenni di Mini documentate."
        },
        "limits": {
          "title": "Limite 12 volte superiore",
          "desc": "240 richieste al minuto per chiave, contro 20 del livello gratuito."
        },
        "keys": {
          "title": "Chiavi self-service",
          "desc": "Crea, nomina e revoca fino a 5 chiavi API, con grafici di utilizzo per strumento nella dashboard."
        }
      }
    },
    "tools": {
      "eyebrow": "STRUMENTI",
      "title": "Ogni strumento, entrambi i livelli",
      "subtitle": "Il livello gratuito copre i calcolatori e le tabelle di riferimento. Sviluppatore sblocca i decodificatori e gli archivi.",
      "col_tool": "Strumento",
      "col_free": "Gratis",
      "col_developer": "Sviluppatore",
      "included": "Incluso",
      "not_included": "Non incluso",
      "rate_limit": "Limite di richieste",
      "rate_free": "20 richieste/min",
      "rate_developer": "240 richieste/min",
      "free_note": "Gli identificatori sono i nomi degli strumenti MCP.",
      "docs_cta": "Leggi la documentazione API"
    },
    "pricing": {
      "monthly": "Mensile",
      "yearly": "Annuale",
      "price_monthly": "4,99 $/mese",
      "price_yearly": "47,90 $/anno",
      "monthly_note": "Disdici quando vuoi.",
      "yearly_note": "Pari a 3,99 $/mese.",
      "save": "Risparmia il 20%"
    },
    "cta": {
      "checking": "Verifica dell'account…",
      "title": "Sblocca tutti gli strumenti",
      "subtitle": "Abbonati una volta e ogni chiave del tuo account avrà tutti gli 11 strumenti e il limite superiore.",
      "subscribe": "Abbonati",
      "sign_in_subscribe": "Accedi per abbonarti",
      "free_tier_note": "Vuoi solo i calcolatori?",
      "free_tier_cta": "Crea una chiave gratuita",
      "activating_title": "Attivazione dell'abbonamento…",
      "activating_body": "Pagamento ricevuto. Stiamo sbloccando il tuo account — di solito bastano pochi secondi.",
      "activation_timeout_title": "Ci siamo quasi",
      "activation_timeout_body": "Il pagamento è andato a buon fine, ma l'attivazione richiede più tempo del solito. Aggiorna la pagina tra un minuto — nessuna azione necessaria."
    },
    "subscriber": {
      "badge": "Sviluppatore",
      "title": "Hai tutti gli strumenti",
      "subtitle": "Tutti gli 11 strumenti e il limite di 240/min sono attivi su ogni tua chiave.",
      "manage_keys": "Gestisci le chiavi API"
    },
    "toasts": {
      "subscribed_title": "Benvenuto a bordo!",
      "subscribed_body": "Il tuo abbonamento all'API per sviluppatori è in elaborazione.",
      "canceled_title": "Pagamento annullato",
      "canceled_body": "Nessun addebito effettuato. Abbonati quando vuoi."
    },
    "errors": {
      "checkout_title": "Pagamento non riuscito",
      "checkout_body": "Impossibile avviare il pagamento. Riprova tra un momento."
    }
  },
  "pt": {
    "meta": {
      "title": "API para desenvolvedores - Classic Mini DIY",
      "description": "Leve as calculadoras, os decodificadores e o arquivo do Classic Mini DIY para suas ferramentas de IA via MCP. Nível gratuito para as calculadoras; US$ 4,99/mês desbloqueia tudo."
    },
    "hero": {
      "eyebrow": "API PARA DESENVOLVEDORES",
      "title": "O Classic Mini, nas suas ferramentas de IA",
      "subtitle": "Um endpoint MCP coloca as calculadoras CMDIY, os decodificadores de chassi e motor e os arquivos de rodas e cores dentro do Claude, do Cursor e de qualquer cliente MCP."
    },
    "copy": "Copiar",
    "copied": "Copiado para a área de transferência.",
    "copy_error": "Não foi possível copiar. Selecione o texto e copie manualmente.",
    "about": {
      "eyebrow": "O QUE VOCÊ RECEBE",
      "title": "Feito para entusiastas e criadores de ferramentas",
      "items": {
        "decoders": {
          "title": "Decodificadores de identificação",
          "desc": "Decodifique números de chassi e motor de todas as épocas, direto do seu cliente de IA."
        },
        "archive": {
          "title": "Dados de arquivo",
          "desc": "Consulte os arquivos comunitários de rodas e cores de tinta — décadas de Minis documentados."
        },
        "limits": {
          "title": "Limite 12 vezes maior",
          "desc": "240 solicitações por minuto por chave, contra 20 no nível gratuito."
        },
        "keys": {
          "title": "Chaves self-service",
          "desc": "Crie, nomeie e revogue até 5 chaves de API, com gráficos de uso por ferramenta no painel."
        }
      }
    },
    "tools": {
      "eyebrow": "FERRAMENTAS",
      "title": "Todas as ferramentas, os dois níveis",
      "subtitle": "O nível gratuito cobre as calculadoras e tabelas de referência. Desenvolvedor desbloqueia os decodificadores e arquivos.",
      "col_tool": "Ferramenta",
      "col_free": "Grátis",
      "col_developer": "Desenvolvedor",
      "included": "Incluída",
      "not_included": "Não incluída",
      "rate_limit": "Limite de solicitações",
      "rate_free": "20 solicitações/min",
      "rate_developer": "240 solicitações/min",
      "free_note": "Os identificadores são os nomes das ferramentas MCP.",
      "docs_cta": "Ler a documentação da API"
    },
    "pricing": {
      "monthly": "Mensal",
      "yearly": "Anual",
      "price_monthly": "US$ 4,99/mês",
      "price_yearly": "US$ 47,90/ano",
      "monthly_note": "Cancele quando quiser.",
      "yearly_note": "Equivale a US$ 3,99/mês.",
      "save": "Economize 20%"
    },
    "cta": {
      "checking": "Verificando sua conta…",
      "title": "Desbloqueie o conjunto completo",
      "subtitle": "Assine uma vez e cada chave da sua conta recebe as 11 ferramentas e o limite maior.",
      "subscribe": "Assinar",
      "sign_in_subscribe": "Entre para assinar",
      "free_tier_note": "Só quer as calculadoras?",
      "free_tier_cta": "Crie uma chave gratuita",
      "activating_title": "Ativando sua assinatura…",
      "activating_body": "Pagamento recebido. Estamos desbloqueando sua conta — normalmente leva alguns segundos.",
      "activation_timeout_title": "Quase lá",
      "activation_timeout_body": "Seu pagamento foi concluído, mas a ativação está demorando mais que o normal. Atualize esta página em um minuto — nenhuma ação necessária."
    },
    "subscriber": {
      "badge": "Desenvolvedor",
      "title": "Você tem o conjunto completo",
      "subtitle": "As 11 ferramentas e o limite de 240/min estão ativos em todas as suas chaves.",
      "manage_keys": "Gerenciar chaves de API"
    },
    "toasts": {
      "subscribed_title": "Bem-vindo a bordo!",
      "subscribed_body": "Sua assinatura da API para desenvolvedores está sendo processada.",
      "canceled_title": "Pagamento cancelado",
      "canceled_body": "Nenhuma cobrança foi feita. Assine quando estiver pronto."
    },
    "errors": {
      "checkout_title": "Falha no pagamento",
      "checkout_body": "Não foi possível iniciar o pagamento. Tente novamente em instantes."
    }
  },
  "ru": {
    "meta": {
      "title": "API для разработчиков - Classic Mini DIY",
      "description": "Подключите калькуляторы, декодеры и архив Classic Mini DIY к своим ИИ-инструментам через MCP. Бесплатный уровень для калькуляторов; 4,99 $/мес открывает всё."
    },
    "hero": {
      "eyebrow": "API ДЛЯ РАЗРАБОТЧИКОВ",
      "title": "Classic Mini — в ваших ИИ-инструментах",
      "subtitle": "Один endpoint MCP даёт калькуляторы CMDIY, декодеры шасси и двигателя и архивы колёс и цветов внутри Claude, Cursor и любого клиента MCP."
    },
    "copy": "Копировать",
    "copied": "Скопировано в буфер обмена.",
    "copy_error": "Не удалось скопировать. Выделите текст и скопируйте вручную.",
    "about": {
      "eyebrow": "ЧТО ВЫ ПОЛУЧАЕТЕ",
      "title": "Для энтузиастов и создателей инструментов",
      "items": {
        "decoders": {
          "title": "Декодеры идентификации",
          "desc": "Расшифровывайте номера шасси и двигателя всех эпох прямо из вашего ИИ-клиента."
        },
        "archive": {
          "title": "Архивные данные",
          "desc": "Запрашивайте архивы колёс и цветов краски сообщества — десятилетия задокументированных Mini."
        },
        "limits": {
          "title": "Лимит в 12 раз выше",
          "desc": "240 запросов в минуту на ключ против 20 на бесплатном уровне."
        },
        "keys": {
          "title": "Самостоятельные ключи",
          "desc": "Создавайте, называйте и отзывайте до 5 ключей API с графиками использования по инструментам."
        }
      }
    },
    "tools": {
      "eyebrow": "ИНСТРУМЕНТЫ",
      "title": "Все инструменты, оба уровня",
      "subtitle": "Бесплатный уровень включает калькуляторы и справочные таблицы. Уровень «Разработчик» открывает декодеры и архивы.",
      "col_tool": "Инструмент",
      "col_free": "Бесплатно",
      "col_developer": "Разработчик",
      "included": "Включено",
      "not_included": "Не включено",
      "rate_limit": "Лимит запросов",
      "rate_free": "20 запросов/мин",
      "rate_developer": "240 запросов/мин",
      "free_note": "Идентификаторы — это имена инструментов MCP.",
      "docs_cta": "Читать документацию API"
    },
    "pricing": {
      "monthly": "Ежемесячно",
      "yearly": "Ежегодно",
      "price_monthly": "4,99 $/мес",
      "price_yearly": "47,90 $/год",
      "monthly_note": "Отмена в любой момент.",
      "yearly_note": "Это 3,99 $/мес.",
      "save": "Скидка 20%"
    },
    "cta": {
      "checking": "Проверяем ваш аккаунт…",
      "title": "Откройте полный набор инструментов",
      "subtitle": "Подпишитесь один раз — и каждый ключ вашего аккаунта получит все 11 инструментов и повышенный лимит.",
      "subscribe": "Подписаться",
      "sign_in_subscribe": "Войдите, чтобы подписаться",
      "free_tier_note": "Нужны только калькуляторы?",
      "free_tier_cta": "Создайте бесплатный ключ",
      "activating_title": "Активируем подписку…",
      "activating_body": "Платёж получен. Открываем доступ — обычно это занимает несколько секунд.",
      "activation_timeout_title": "Почти готово",
      "activation_timeout_body": "Платёж прошёл, но активация занимает больше времени, чем обычно. Обновите страницу через минуту — ничего делать не нужно."
    },
    "subscriber": {
      "badge": "Разработчик",
      "title": "У вас полный набор инструментов",
      "subtitle": "Все 11 инструментов и лимит 240/мин активны на каждом вашем ключе.",
      "manage_keys": "Управлять ключами API"
    },
    "toasts": {
      "subscribed_title": "Добро пожаловать!",
      "subscribed_body": "Ваша подписка на API для разработчиков обрабатывается.",
      "canceled_title": "Оплата отменена",
      "canceled_body": "Средства не списаны. Подпишитесь, когда будете готовы."
    },
    "errors": {
      "checkout_title": "Ошибка оплаты",
      "checkout_body": "Не удалось начать оплату. Повторите попытку через минуту."
    }
  },
  "ja": {
    "meta": {
      "title": "開発者向けAPI - Classic Mini DIY",
      "description": "Classic Mini DIY の計算ツール、デコーダー、アーカイブを MCP 経由で AI ツールに。計算ツールは無料プラン、月額4.99ドルですべて解放。"
    },
    "hero": {
      "eyebrow": "開発者向けAPI",
      "title": "クラシックミニを、あなたのAIツールに",
      "subtitle": "1つの MCP エンドポイントで、CMDIY の計算ツール、シャシー／エンジンのデコーダー、ホイールとカラーのアーカイブを Claude、Cursor、あらゆる MCP クライアントで使えます。"
    },
    "copy": "コピー",
    "copied": "クリップボードにコピーしました。",
    "copy_error": "コピーできませんでした。テキストを選択して手動でコピーしてください。",
    "about": {
      "eyebrow": "提供内容",
      "title": "いじり好きとツール開発者のために",
      "items": {
        "decoders": {
          "title": "識別デコーダー",
          "desc": "あらゆる年代のシャシー番号とエンジン番号を、AI クライアントから直接解読。"
        },
        "archive": {
          "title": "アーカイブデータ",
          "desc": "コミュニティのホイールと塗装色のアーカイブを検索 — 数十年分の記録されたミニ。"
        },
        "limits": {
          "title": "12倍のレート上限",
          "desc": "キーごとに毎分240リクエスト（無料プランは20）。"
        },
        "keys": {
          "title": "セルフサービスのキー",
          "desc": "最大5個の API キーを作成・命名・無効化。ダッシュボードでツール別の利用グラフも。"
        }
      }
    },
    "tools": {
      "eyebrow": "ツール",
      "title": "全ツール、両プラン対応表",
      "subtitle": "無料プランは計算ツールと参照表をカバー。開発者プランはデコーダーとアーカイブを解放します。",
      "col_tool": "ツール",
      "col_free": "無料",
      "col_developer": "開発者",
      "included": "含まれる",
      "not_included": "含まれない",
      "rate_limit": "レート上限",
      "rate_free": "毎分20リクエスト",
      "rate_developer": "毎分240リクエスト",
      "free_note": "識別子は MCP のツール名です。",
      "docs_cta": "APIドキュメントを読む"
    },
    "pricing": {
      "monthly": "月額",
      "yearly": "年額",
      "price_monthly": "$4.99/月",
      "price_yearly": "$47.90/年",
      "monthly_note": "いつでも解約できます。",
      "yearly_note": "月あたり $3.99 です。",
      "save": "20%お得"
    },
    "cta": {
      "checking": "アカウントを確認中…",
      "title": "フルツールセットを解放",
      "subtitle": "一度サブスクリプションに登録すれば、アカウントのすべてのキーで11個のツールと高いレート上限が使えます。",
      "subscribe": "登録する",
      "sign_in_subscribe": "ログインして登録",
      "free_tier_note": "計算ツールだけで十分ですか？",
      "free_tier_cta": "無料キーを作成",
      "activating_title": "サブスクリプションを有効化中…",
      "activating_body": "お支払いを受け付けました。アカウントを解放しています — 通常は数秒で完了します。",
      "activation_timeout_title": "もう少しです",
      "activation_timeout_body": "お支払いは完了しましたが、有効化に通常より時間がかかっています。1分後にページを更新してください — 操作は不要です。"
    },
    "subscriber": {
      "badge": "開発者",
      "title": "フルツールセットが有効です",
      "subtitle": "11個すべてのツールと毎分240の上限が、お持ちのすべてのキーで有効です。",
      "manage_keys": "APIキーを管理"
    },
    "toasts": {
      "subscribed_title": "ようこそ！",
      "subscribed_body": "開発者向けAPIのサブスクリプションを処理しています。",
      "canceled_title": "購入がキャンセルされました",
      "canceled_body": "請求は発生していません。準備ができたらいつでも登録してください。"
    },
    "errors": {
      "checkout_title": "購入に失敗しました",
      "checkout_body": "購入を開始できませんでした。しばらくしてからもう一度お試しください。"
    }
  },
  "zh": {
    "meta": {
      "title": "开发者 API - Classic Mini DIY",
      "description": "通过 MCP 把 Classic Mini DIY 的计算器、解码器和档案库带入您的 AI 工具。计算器免费；每月 4.99 美元解锁全部。"
    },
    "hero": {
      "eyebrow": "开发者 API",
      "title": "把经典 Mini 装进您的 AI 工具",
      "subtitle": "一个 MCP 端点，让 CMDIY 计算器、车架号和发动机解码器、轮毂与颜色档案进入 Claude、Cursor 及任何 MCP 客户端。"
    },
    "copy": "复制",
    "copied": "已复制到剪贴板。",
    "copy_error": "无法复制。请选中文本手动复制。",
    "about": {
      "eyebrow": "您将获得",
      "title": "为爱好者和工具开发者打造",
      "items": {
        "decoders": {
          "title": "识别解码器",
          "desc": "在 AI 客户端中直接解码各年代的车架号和发动机号。"
        },
        "archive": {
          "title": "档案数据",
          "desc": "查询社区轮毂和车漆颜色档案——数十年的 Mini 记录。"
        },
        "limits": {
          "title": "12 倍速率上限",
          "desc": "每个密钥每分钟 240 次请求，免费档为 20 次。"
        },
        "keys": {
          "title": "自助密钥",
          "desc": "创建、命名和吊销最多 5 个 API 密钥，仪表板中有按工具统计的用量图表。"
        }
      }
    },
    "tools": {
      "eyebrow": "工具",
      "title": "全部工具，两档对比",
      "subtitle": "免费档涵盖计算器和参考数据表。开发者档解锁解码器和档案库。",
      "col_tool": "工具",
      "col_free": "免费",
      "col_developer": "开发者",
      "included": "包含",
      "not_included": "不包含",
      "rate_limit": "速率上限",
      "rate_free": "每分钟 20 次",
      "rate_developer": "每分钟 240 次",
      "free_note": "标识符即 MCP 工具名称。",
      "docs_cta": "阅读 API 文档"
    },
    "pricing": {
      "monthly": "按月",
      "yearly": "按年",
      "price_monthly": "$4.99/月",
      "price_yearly": "$47.90/年",
      "monthly_note": "随时取消。",
      "yearly_note": "相当于每月 $3.99。",
      "save": "省 20%"
    },
    "cta": {
      "checking": "正在检查您的账户…",
      "title": "解锁全套工具",
      "subtitle": "订阅一次，账户中的每个密钥都将获得全部 11 个工具和更高的速率上限。",
      "subscribe": "订阅",
      "sign_in_subscribe": "登录后订阅",
      "free_tier_note": "只需要计算器？",
      "free_tier_cta": "创建免费密钥",
      "activating_title": "正在激活您的订阅…",
      "activating_body": "已收到付款。正在为您的账户解锁——通常只需几秒钟。",
      "activation_timeout_title": "就快好了",
      "activation_timeout_body": "您的付款已成功，但激活比平时慢。请一分钟后刷新此页面——无需任何操作。"
    },
    "subscriber": {
      "badge": "开发者",
      "title": "您已拥有全套工具",
      "subtitle": "全部 11 个工具和每分钟 240 次的上限已在您的所有密钥上生效。",
      "manage_keys": "管理 API 密钥"
    },
    "toasts": {
      "subscribed_title": "欢迎加入！",
      "subscribed_body": "您的开发者 API 订阅正在处理中。",
      "canceled_title": "已取消结账",
      "canceled_body": "未产生任何费用。准备好后随时订阅。"
    },
    "errors": {
      "checkout_title": "结账失败",
      "checkout_body": "无法启动结账。请稍后重试。"
    }
  },
  "ko": {
    "meta": {
      "title": "개발자 API - Classic Mini DIY",
      "description": "MCP를 통해 Classic Mini DIY의 계산기, 디코더, 아카이브를 AI 도구로 가져오세요. 계산기는 무료 등급, 월 $4.99로 전체 잠금 해제."
    },
    "hero": {
      "eyebrow": "개발자 API",
      "title": "클래식 미니를 당신의 AI 도구 안에",
      "subtitle": "하나의 MCP 엔드포인트로 CMDIY 계산기, 섀시·엔진 디코더, 휠·컬러 아카이브를 Claude, Cursor 및 모든 MCP 클라이언트에서 사용할 수 있습니다."
    },
    "copy": "복사",
    "copied": "클립보드에 복사되었습니다.",
    "copy_error": "복사할 수 없습니다. 텍스트를 선택해 직접 복사하세요.",
    "about": {
      "eyebrow": "제공 내용",
      "title": "애호가와 도구 제작자를 위해",
      "items": {
        "decoders": {
          "title": "식별 디코더",
          "desc": "모든 연대의 섀시·엔진 번호를 AI 클라이언트에서 바로 해독하세요."
        },
        "archive": {
          "title": "아카이브 데이터",
          "desc": "커뮤니티 휠·도색 컬러 아카이브를 조회하세요 — 수십 년간 기록된 미니들."
        },
        "limits": {
          "title": "12배 높은 속도 한도",
          "desc": "키당 분당 240회 요청 (무료 등급은 20회)."
        },
        "keys": {
          "title": "셀프서비스 키",
          "desc": "최대 5개의 API 키를 생성·이름 지정·폐기하고, 대시보드에서 도구별 사용량 차트를 확인하세요."
        }
      }
    },
    "tools": {
      "eyebrow": "도구",
      "title": "모든 도구, 두 등급 비교",
      "subtitle": "무료 등급은 계산기와 참조 표를 포함합니다. 개발자 등급은 디코더와 아카이브를 잠금 해제합니다.",
      "col_tool": "도구",
      "col_free": "무료",
      "col_developer": "개발자",
      "included": "포함",
      "not_included": "미포함",
      "rate_limit": "속도 한도",
      "rate_free": "분당 20회",
      "rate_developer": "분당 240회",
      "free_note": "식별자는 MCP 도구 이름입니다.",
      "docs_cta": "API 문서 읽기"
    },
    "pricing": {
      "monthly": "월간",
      "yearly": "연간",
      "price_monthly": "$4.99/월",
      "price_yearly": "$47.90/년",
      "monthly_note": "언제든 해지 가능.",
      "yearly_note": "월 $3.99에 해당합니다.",
      "save": "20% 할인"
    },
    "cta": {
      "checking": "계정 확인 중…",
      "title": "전체 도구 세트를 잠금 해제하세요",
      "subtitle": "한 번 구독하면 계정의 모든 키에서 11개 도구와 더 높은 속도 한도를 사용할 수 있습니다.",
      "subscribe": "구독하기",
      "sign_in_subscribe": "로그인하고 구독하기",
      "free_tier_note": "계산기만 필요하신가요?",
      "free_tier_cta": "무료 키 만들기",
      "activating_title": "구독을 활성화하는 중…",
      "activating_body": "결제가 완료되었습니다. 계정을 잠금 해제하는 중입니다 — 보통 몇 초면 끝납니다.",
      "activation_timeout_title": "거의 다 됐습니다",
      "activation_timeout_body": "결제는 완료되었지만 활성화가 평소보다 오래 걸리고 있습니다. 1분 후 페이지를 새로고침하세요 — 별도 조치는 필요 없습니다."
    },
    "subscriber": {
      "badge": "개발자",
      "title": "전체 도구 세트를 보유 중입니다",
      "subtitle": "11개 도구 전체와 분당 240회 한도가 모든 키에서 활성화되어 있습니다.",
      "manage_keys": "API 키 관리"
    },
    "toasts": {
      "subscribed_title": "환영합니다!",
      "subscribed_body": "개발자 API 구독이 처리되고 있습니다.",
      "canceled_title": "결제가 취소되었습니다",
      "canceled_body": "청구된 금액은 없습니다. 준비되면 언제든 구독하세요."
    },
    "errors": {
      "checkout_title": "결제 실패",
      "checkout_body": "결제를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요."
    }
  }
}
</i18n>
