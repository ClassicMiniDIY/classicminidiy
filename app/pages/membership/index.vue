<script lang="ts" setup>
  import { CHAT_QUOTAS, MEMBERSHIP_PLANS, type MembershipPlan } from '~~/shared/utils/chatTiers';
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { add: addToast } = useToast();
  const { isAuthenticated, isSustainingMember, user, waitForAuth, fetchUserProfile } = useAuth();

  // Canonical benefit list (keystone §4). Order is part of the contract — do
  // not reorder. Copy lives in the i18n block below, verbatim from the keystone.
  // "Members-only blog posts" was retired 2026-10-06 with the Ghost blog.
  const benefits = [
    { icon: 'fas fa-user', key: 'one_account' },
    { icon: 'fas fa-screwdriver-wrench', key: 'maintenance' },
    { icon: 'fab fa-discord', key: 'discord' },
    { icon: 'fas fa-tag', key: 'listings' },
    { icon: 'fas fa-hand-holding-heart', key: 'support' },
  ];

  const authReady = ref(false);
  const checkoutLoading = ref(false);

  // Logged-out subscribe intent (pre-launch punch list D1): route the visitor
  // through sign-in with the intent preserved as ?subscribe=1, so after auth
  // they land back here and checkout auto-starts (see onMounted). The login
  // page persists the redirect across the OAuth/magic-link round trip.
  // `plan` rides along so the plan chosen before sign-in is the one checked out.
  const loginWithIntentHref = (plan: MembershipPlan = 'base') =>
    `/login?redirect=${encodeURIComponent(`/membership?subscribe=1&plan=${plan}`)}`;

  /**
   * The three plans as sold (design: classicminidiy-supabase
   * docs/plans/2026-09-19-chat-tiers.md). Every plan is the same membership —
   * same badge, sync, Discord, listings — and differs in exactly one thing:
   * the monthly DIY Mini Bot allowance, which comes from the shared quota
   * contract so this page can never quote a number the chat does not enforce.
   */
  const plans = MEMBERSHIP_PLANS.map((p) => ({
    plan: p.plan,
    usd: p.usd,
    questions: CHAT_QUOTAS[p.tier].perMonth ?? 0,
  }));
  const planLabel = (plan: string | null | undefined) =>
    plan === 'plus' || plan === 'pro' ? t(`plans.${plan}.name`) : t('plans.base.name');

  // Post-checkout activation poll (punch list D1): on return with ?subscribed=1
  // the Stripe webhook may not have written the subscriptions row yet, so a
  // single re-pull can still show the subscribe CTA to the user who just paid.
  // The poll loop itself lives in useSubscriptionPolling (shared with
  // /developers); this page supplies the membership entitlement check. Signed
  // out mid-poll = 'abort': nothing to activate for this browser anymore.
  const { activationState, pollActivation } = useSubscriptionPolling(async () => {
    if (!user.value) return 'abort';
    await fetchUserProfile(user.value.id);
    return isSustainingMember.value ? 'active' : 'pending';
  });

  async function pollMembershipActivation() {
    if (!user.value || isSustainingMember.value) return;
    await pollActivation();
  }

  // Hero price badge: gate on resolved auth so members never see a
  // "$1.99/month" flash before membership resolves; also hidden while the
  // activation poll runs (the user just paid).
  const showPriceBadge = computed(
    () => authReady.value && !isSustainingMember.value && activationState.value === 'idle'
  );

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  // Subscribe via Stripe Checkout (keystone §9): a logged-in user hits the
  // checkout proxy → create-membership-checkout → Stripe Checkout URL. Logged-out
  // users are routed through sign-in first so the webhook can attribute the row.
  const checkoutPlan = ref<MembershipPlan | null>(null);
  async function subscribe(plan: MembershipPlan = 'base') {
    if (!isAuthenticated.value) {
      navigateTo(loginWithIntentHref(plan));
      return;
    }
    checkoutLoading.value = true;
    checkoutPlan.value = plan;
    track('membership_checkout_started', { source: 'web', plan });
    try {
      const token = await getAccessToken();
      if (!token) {
        // Session evaporated between the auth check and checkout — send them
        // back through sign-in with the subscribe intent preserved.
        navigateTo(loginWithIntentHref(plan));
        return;
      }
      const res = await $fetch<{ url?: string }>('/api/membership/checkout', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { plan },
      });
      if (!res?.url) throw new Error('Missing checkout URL');
      await navigateTo(res.url, { external: true });
    } catch (error: any) {
      console.error('Membership checkout failed:', error);
      // The edge function answers 503 PLAN_UNAVAILABLE for a plan whose Stripe
      // price is not configured yet: a rollout gap, not a failure to retry.
      const unavailable = error?.statusCode === 503 || error?.data?.code === 'PLAN_UNAVAILABLE';
      addToast({
        title: t('errors.checkout_title'),
        description: unavailable ? t('errors.plan_unavailable', { plan: planLabel(plan) }) : t('errors.checkout_body'),
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      checkoutLoading.value = false;
      checkoutPlan.value = null;
    }
  }

  // /membership#ways-to-join: the browser scrolls to the anchor on load, but the
  // ClientOnly card above it is a short spinner until auth resolves and then
  // grows, which pushes the section down (seen on iOS Safari). Re-scroll ONCE
  // after that, unless the visitor has already scrolled themselves.
  const WAYS_TO_JOIN_HASH = '#ways-to-join';
  const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown', 'mousedown'] as const;
  let stopWatchingUserScroll = () => {};
  function keepWaysToJoinInView(): () => Promise<void> {
    if (window.location.hash !== WAYS_TO_JOIN_HASH) return async () => {};
    let userScrolled = false;
    const mark = () => (userScrolled = true);
    for (const e of USER_SCROLL_EVENTS) window.addEventListener(e, mark, { passive: true, once: true });
    stopWatchingUserScroll = () => {
      for (const e of USER_SCROLL_EVENTS) window.removeEventListener(e, mark);
    };
    return async () => {
      stopWatchingUserScroll();
      await nextTick();
      if (!userScrolled && window.location.hash === WAYS_TO_JOIN_HASH) {
        document.getElementById('ways-to-join')?.scrollIntoView();
      }
    };
  }
  // Leaving before auth resolves must not leave the listeners on window.
  onBeforeUnmount(() => stopWatchingUserScroll());

  onMounted(async () => {
    const rescrollToWaysToJoin = keepWaysToJoinInView();
    await waitForAuth();
    authReady.value = true;
    rescrollToWaysToJoin();

    // Stripe returns to /membership?subscribed=1 or ?canceled=1; sign-in
    // returns with ?subscribe=1 (preserved intent). Process once, then strip
    // the params so a refresh doesn't replay the toast / checkout.
    if (route.query.subscribed || route.query.canceled || route.query.subscribe) {
      if (route.query.subscribed) {
        track('membership_checkout_succeeded', { source: 'web' });
        addToast({
          title: t('toasts.subscribed_title'),
          description: t('toasts.subscribed_body'),
          color: 'success',
          icon: 'fas fa-circle-check',
          timeout: 8000,
        });
        // The subscriptions row is written asynchronously by the webhook; poll
        // the membership gate until it flips (or gently time out) so the payer
        // never sees the subscribe CTA again during the race window.
        pollMembershipActivation();
      } else if (route.query.canceled) {
        addToast({
          title: t('toasts.canceled_title'),
          description: t('toasts.canceled_body'),
          color: 'info',
          icon: 'fas fa-circle-info',
        });
      }
      // Restored sign-in intent: auto-start checkout for an authenticated
      // non-member. Members and logged-out visitors just see the page.
      const shouldAutoSubscribe =
        route.query.subscribe === '1' &&
        !route.query.subscribed &&
        !route.query.canceled &&
        isAuthenticated.value &&
        !isSustainingMember.value;
      const intentPlan = plans.find((p) => p.plan === route.query.plan)?.plan ?? 'base';
      const { subscribed: _subscribed, canceled: _canceled, subscribe: _subscribe, plan: _plan, ...rest } = route.query;
      router.replace({ query: rest });
      if (shouldAutoSubscribe) subscribe(intentPlan);
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
  <div class="membership-page">
    <!-- Hero / value prop -->
    <section class="hero bg-base-200 border-b border-base-300">
      <div class="hero-content text-center py-14">
        <div class="max-w-2xl">
          <span class="eyebrow"><i class="fas fa-star mr-1 text-warning"></i>{{ t('hero.eyebrow') }}</span>
          <h1 class="text-4xl sm:text-5xl font-bold pt-2 pb-4">{{ t('hero.title') }}</h1>
          <div v-if="showPriceBadge" class="badge badge-warning badge-lg font-semibold gap-1 mb-4">
            <i class="fas fa-tag"></i> {{ t('hero.price') }}
          </div>
          <p class="text-lg opacity-80">{{ t('hero.subtitle') }}</p>
        </div>
      </div>
    </section>

    <div class="container mx-auto px-4 py-12 max-w-4xl space-y-12">
      <!-- Benefit list -->
      <section>
        <p class="eyebrow text-center"><i class="fas fa-list-check mr-1"></i>{{ t('benefits.eyebrow') }}</p>
        <h2 class="text-3xl font-bold text-center pt-2 pb-8">{{ t('benefits.title') }}</h2>
        <ul class="benefits-list grid grid-cols-1 sm:grid-cols-2 gap-4">
          <li v-for="benefit in benefits" :key="benefit.key" class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-5 flex-row items-start gap-4">
              <span class="text-2xl text-primary shrink-0 mt-1">
                <i :class="benefit.icon"></i>
              </span>
              <div>
                <h3 class="font-bold">{{ t(`benefits.items.${benefit.key}.title`) }}</h3>
                <p class="text-sm opacity-70 mt-1">{{ t(`benefits.items.${benefit.key}.desc`) }}</p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- CTA / management (client-reactive on auth + membership state) -->
      <ClientOnly>
        <!-- Resolving auth + membership: show a spinner so members never flash
             the sign-in CTA before the Discord/benefits area appears. -->
        <section v-if="!authReady" class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
            <p class="opacity-60 mt-3">{{ t('cta.checking') }}</p>
          </div>
        </section>

        <!-- Active member: the management card lives on /settings/membership.
             This page is the public sales and checkout page, so a member gets
             a pointer there instead. -->
        <section v-else-if="isSustainingMember" class="card bg-base-100 border border-primary/40 shadow-md">
          <div class="card-body flex-row flex-wrap items-center gap-4">
            <ProfileSustainingBadge size="md" />
            <div class="min-w-0 flex-1">
              <h2 class="text-2xl font-bold" data-testid="member-title">{{ t('member.title_pending') }}</h2>
              <p class="opacity-70">{{ t('member.settings_body') }}</p>
            </div>
            <NuxtLink to="/settings/membership" class="btn btn-primary" data-testid="member-settings-link">
              <i class="fas fa-gear"></i>
              {{ t('member.settings_cta') }}
            </NuxtLink>
          </div>
        </section>

        <!-- Post-checkout webhook race window: "Activating…" instead of the
             subscribe CTA while the membership gate is polled (punch list D1). -->
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

        <!-- Non-member / logged-out: subscribe CTA -->
        <section v-else class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center">
            <h2 class="text-2xl font-bold">{{ t('cta.title') }}</h2>
            <p class="opacity-70 max-w-lg">{{ t('cta.subtitle') }}</p>

            <!-- Plan picker. One membership, three allowances: the only line
                 that differs between the cards is the DIY Mini Bot count. -->
            <div class="plan-grid grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 w-full">
              <div
                v-for="p in plans"
                :key="p.plan"
                class="card border shadow-sm text-left"
                :class="p.plan === 'plus' ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100'"
              >
                <div class="card-body p-5 gap-2">
                  <p class="eyebrow">
                    {{ t(`plans.${p.plan}.name`) }}
                    <span v-if="p.plan === 'plus'" class="badge badge-primary badge-sm ml-1">{{
                      t('plans.popular')
                    }}</span>
                  </p>
                  <p class="text-3xl font-bold">
                    ${{ p.usd.toFixed(2)
                    }}<span class="text-sm font-normal opacity-60">{{ t('plans.per_month') }}</span>
                  </p>
                  <p class="text-sm">
                    <i class="fas fa-comments mr-1 text-primary"></i>{{ t('plans.questions', { count: p.questions }) }}
                  </p>
                  <p class="text-xs opacity-60">{{ t('plans.same_benefits') }}</p>
                  <div class="card-actions mt-2">
                    <button
                      v-if="isAuthenticated"
                      class="btn btn-sm w-full"
                      :class="p.plan === 'plus' ? 'btn-primary' : 'btn-outline btn-primary'"
                      :disabled="checkoutLoading"
                      @click="subscribe(p.plan)"
                    >
                      <i v-if="checkoutLoading && checkoutPlan === p.plan" class="fas fa-spinner fa-spin"></i>
                      <i v-else class="fas fa-star"></i>
                      {{ t('plans.choose', { plan: t(`plans.${p.plan}.name`) }) }}
                    </button>
                    <NuxtLink
                      v-else
                      :to="loginWithIntentHref(p.plan)"
                      class="btn btn-sm w-full"
                      :class="p.plan === 'plus' ? 'btn-primary' : 'btn-outline btn-primary'"
                    >
                      <i class="fas fa-right-to-bracket"></i>
                      {{ t('cta.signin') }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>

            <p class="text-sm opacity-60 mt-3"><i class="fas fa-mobile-screen mr-1"></i>{{ t('cta.also_apps') }}</p>
          </div>
        </section>

        <template #fallback>
          <!-- SSR / pre-hydration: spinner matching the !authReady state so there
               is no flash between server render and the resolved client state. -->
          <section class="card bg-base-100 border border-base-300 shadow-md">
            <div class="card-body items-center text-center py-12">
              <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
              <p class="opacity-60 mt-3">{{ t('cta.checking') }}</p>
            </div>
          </section>
        </template>
      </ClientOnly>

      <!-- /membership#ways-to-join: the one page support replies, the YouTube and
           Patreon level descriptions and the apps link to (membership clarity
           §4.1). Server-rendered, outside ClientOnly, so the anchor resolves on
           first load. Do not rename the id. -->
      <section id="ways-to-join" class="scroll-mt-24">
        <MembershipWaysToJoin />
      </section>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Sustaining Member — Classic Mini DIY",
      "description": "Become a Sustaining Member (from $1.99/month) for one account across Classic Mini DIY, The Mini Exchange, and the Toolbox apps, a members-only Discord, free premium listings on The Mini Exchange, and to support the channel."
    },
    "hero": {
      "eyebrow": "SUSTAINING MEMBER",
      "title": "One membership, every Classic Mini DIY property",
      "price": "From $1.99/month",
      "subtitle": "Subscribe here, or in the iOS and Android apps — same price, same benefits everywhere."
    },
    "benefits": {
      "eyebrow": "WHAT YOU GET",
      "title": "Sustaining Member benefits",
      "items": {
        "one_account": {
          "title": "One account across everything",
          "desc": "classicminidiy.com, The Mini Exchange, and the Classic Mini DIY Toolbox apps. One profile, one login, a Sustaining Member badge on your public profile."
        },
        "maintenance": {
          "title": "Maintenance tracking",
          "desc": "Multi-vehicle garage, service history, smart reminders, PDF export, cloud-synced (in the apps)."
        },
        "discord": {
          "title": "Members-only Discord",
          "desc": "A private community to talk shop, share builds, and get help."
        },
        "listings": {
          "title": "Free premium listings on The Mini Exchange",
          "desc": "Premium listing upgrade included at no charge while your membership is active."
        },
        "support": {
          "title": "Support the channel",
          "desc": "Fund continued development and free technical resources for the Classic Mini community."
        }
      }
    },
    "cta": {
      "title": "Become a Sustaining Member",
      "subtitle": "From $1.99/month, cancel anytime. Every plan unlocks the same benefits across every Classic Mini DIY property — pick the DIY Mini Bot allowance that fits.",
      "checking": "Checking your membership…",
      "activating_title": "Activating your membership…",
      "activating_body": "Payment received — we're switching on your benefits. This usually takes a few seconds.",
      "activation_timeout_title": "Taking longer than expected",
      "activation_timeout_body": "Your payment went through, but activation is taking a little longer than usual. Refresh this page in a minute — if your membership still isn't active, reach out via the contact page and we'll sort it out.",
      "signin": "Sign in to become a member",
      "also_apps": "Also available in the iOS and Android apps."
    },
    "member": {
      "title_pending": "You're a Sustaining Member",
      "settings_body": "Manage your plan, billing and Discord access in Settings.",
      "settings_cta": "Manage membership"
    },
    "errors": {
      "checkout_title": "Checkout unavailable",
      "checkout_body": "We couldn't start your membership checkout. Please try again in a moment.",
      "plan_unavailable": "{plan} isn't available to buy yet. Please try again soon or pick another plan."
    },
    "toasts": {
      "subscribed_title": "Welcome, Sustaining Member!",
      "subscribed_body": "Your membership is being activated — your benefits will appear shortly.",
      "canceled_title": "Checkout canceled",
      "canceled_body": "No charge was made. You can become a Sustaining Member whenever you're ready."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Most popular",
      "per_month": "/month",
      "questions": "{count} DIY Mini Bot questions a month",
      "same_benefits": "Every other benefit is identical on all plans.",
      "choose": "Choose {plan}"
    }
  },
  "es": {
    "meta": {
      "title": "Socio Colaborador — Classic Mini DIY",
      "description": "Hazte Socio Colaborador (desde 1,99 $/mes) y consigue una sola cuenta para Classic Mini DIY, The Mini Exchange y las apps Toolbox, un Discord exclusivo para socios, anuncios premium gratis en The Mini Exchange y apoya al canal."
    },
    "hero": {
      "eyebrow": "SOCIO COLABORADOR",
      "title": "Una membresía, todos los sitios de Classic Mini DIY",
      "price": "Desde $1.99/mes",
      "subtitle": "Suscríbete aquí o en las apps de iOS y Android: mismo precio y mismas ventajas en todas partes."
    },
    "benefits": {
      "eyebrow": "QUÉ INCLUYE",
      "title": "Ventajas de Socio Colaborador",
      "items": {
        "one_account": {
          "title": "Una cuenta para todo",
          "desc": "classicminidiy.com, The Mini Exchange y las apps Classic Mini DIY Toolbox. Un perfil, un inicio de sesión y una insignia de Socio Colaborador en tu perfil público."
        },
        "maintenance": {
          "title": "Seguimiento del mantenimiento",
          "desc": "Garaje multivehículo, historial de servicio, recordatorios inteligentes, exportación a PDF y sincronización en la nube (en las apps)."
        },
        "discord": {
          "title": "Discord exclusivo para socios",
          "desc": "Una comunidad privada para hablar de mecánica, compartir proyectos y pedir ayuda."
        },
        "listings": {
          "title": "Anuncios premium gratis en The Mini Exchange",
          "desc": "Mejora a anuncio premium incluida sin coste mientras tu membresía esté activa."
        },
        "support": {
          "title": "Apoya al canal",
          "desc": "Financia el desarrollo continuo y los recursos técnicos gratuitos para la comunidad del Classic Mini."
        }
      }
    },
    "cta": {
      "title": "Hazte Socio Colaborador",
      "subtitle": "Desde $1.99/mes, cancela cuando quieras. Todos los planes desbloquean los mismos beneficios en todas las propiedades de Classic Mini DIY — elige el límite del DIY Mini Bot que te convenga.",
      "checking": "Comprobando tu membresía…",
      "activating_title": "Activando tu membresía…",
      "activating_body": "Pago recibido: estamos activando tus ventajas. Suele tardar unos segundos.",
      "activation_timeout_title": "Está tardando más de lo previsto",
      "activation_timeout_body": "Tu pago se ha completado, pero la activación está tardando algo más de lo normal. Actualiza esta página en un minuto; si tu membresía sigue sin estar activa, escríbenos desde la página de contacto y lo solucionamos.",
      "signin": "Inicia sesión para hacerte socio",
      "also_apps": "También disponible en las apps de iOS y Android."
    },
    "member": {
      "title_pending": "Eres Socio Colaborador",
      "settings_body": "Gestiona tu plan, la facturación y el acceso a Discord en Ajustes.",
      "settings_cta": "Gestionar membresía"
    },
    "errors": {
      "checkout_title": "Pago no disponible",
      "checkout_body": "No hemos podido iniciar el pago de tu membresía. Inténtalo de nuevo en un momento.",
      "plan_unavailable": "{plan} aún no está disponible. Inténtalo de nuevo pronto o elige otro plan."
    },
    "toasts": {
      "subscribed_title": "¡Bienvenido, Socio Colaborador!",
      "subscribed_body": "Tu membresía se está activando: tus ventajas aparecerán en breve.",
      "canceled_title": "Pago cancelado",
      "canceled_body": "No se ha realizado ningún cargo. Puedes hacerte Socio Colaborador cuando quieras."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Más popular",
      "per_month": "/mes",
      "questions": "{count} preguntas al DIY Mini Bot al mes",
      "same_benefits": "Los demás beneficios son idénticos en todos los planes.",
      "choose": "Elegir {plan}"
    }
  },
  "fr": {
    "meta": {
      "title": "Membre de soutien — Classic Mini DIY",
      "description": "Devenez membre de soutien (à partir de 1,99 $/mois) : un seul compte pour Classic Mini DIY, The Mini Exchange et les applis Toolbox, un Discord réservé aux membres, des annonces premium gratuites sur The Mini Exchange, et un soutien à la chaîne."
    },
    "hero": {
      "eyebrow": "MEMBRE DE SOUTIEN",
      "title": "Une adhésion, tous les sites Classic Mini DIY",
      "price": "À partir de 1,99 $/mois",
      "subtitle": "Abonnez-vous ici ou dans les applis iOS et Android : même prix, mêmes avantages partout."
    },
    "benefits": {
      "eyebrow": "CE QUE VOUS OBTENEZ",
      "title": "Avantages du membre de soutien",
      "items": {
        "one_account": {
          "title": "Un seul compte pour tout",
          "desc": "classicminidiy.com, The Mini Exchange et les applis Classic Mini DIY Toolbox. Un profil, une connexion, et un badge Membre de soutien sur votre profil public."
        },
        "maintenance": {
          "title": "Suivi de l'entretien",
          "desc": "Garage multivéhicule, historique d'entretien, rappels intelligents, export PDF, synchronisation cloud (dans les applis)."
        },
        "discord": {
          "title": "Discord réservé aux membres",
          "desc": "Une communauté privée pour parler mécanique, partager vos projets et obtenir de l'aide."
        },
        "listings": {
          "title": "Annonces premium gratuites sur The Mini Exchange",
          "desc": "Passage en annonce premium inclus sans frais tant que votre adhésion est active."
        },
        "support": {
          "title": "Soutenez la chaîne",
          "desc": "Financez le développement continu et les ressources techniques gratuites pour la communauté Classic Mini."
        }
      }
    },
    "cta": {
      "title": "Devenir membre de soutien",
      "subtitle": "À partir de 1,99 $/mois, résiliable à tout moment. Chaque formule débloque les mêmes avantages sur toutes les propriétés Classic Mini DIY — choisissez le quota DIY Mini Bot qui vous convient.",
      "checking": "Vérification de votre adhésion…",
      "activating_title": "Activation de votre adhésion…",
      "activating_body": "Paiement reçu — nous activons vos avantages. Cela prend généralement quelques secondes.",
      "activation_timeout_title": "Cela prend plus de temps que prévu",
      "activation_timeout_body": "Votre paiement est bien passé, mais l'activation prend un peu plus de temps que d'habitude. Actualisez cette page dans une minute ; si votre adhésion n'est toujours pas active, écrivez-nous via la page de contact et nous réglerons ça.",
      "signin": "Connectez-vous pour devenir membre",
      "also_apps": "Également disponible dans les applis iOS et Android."
    },
    "member": {
      "title_pending": "Vous êtes membre de soutien",
      "settings_body": "Gérez votre formule, la facturation et l'accès Discord dans Paramètres.",
      "settings_cta": "Gérer l'adhésion"
    },
    "errors": {
      "checkout_title": "Paiement indisponible",
      "checkout_body": "Nous n'avons pas pu lancer le paiement de votre adhésion. Réessayez dans un instant.",
      "plan_unavailable": "{plan} n'est pas encore disponible à l'achat. Réessayez bientôt ou choisissez une autre formule."
    },
    "toasts": {
      "subscribed_title": "Bienvenue, membre de soutien !",
      "subscribed_body": "Votre adhésion est en cours d'activation — vos avantages apparaîtront sous peu.",
      "canceled_title": "Paiement annulé",
      "canceled_body": "Aucun débit n'a été effectué. Vous pourrez devenir membre de soutien quand vous le souhaiterez."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Le plus populaire",
      "per_month": "/mois",
      "questions": "{count} questions au DIY Mini Bot par mois",
      "same_benefits": "Tous les autres avantages sont identiques pour chaque formule.",
      "choose": "Choisir {plan}"
    }
  },
  "de": {
    "meta": {
      "title": "Fördermitglied — Classic Mini DIY",
      "description": "Werde Fördermitglied (ab 1,99 $/Monat): ein Konto für Classic Mini DIY, The Mini Exchange und die Toolbox-Apps, ein Discord nur für Mitglieder, kostenlose Premium-Anzeigen auf The Mini Exchange – und Unterstützung für den Kanal."
    },
    "hero": {
      "eyebrow": "FÖRDERMITGLIED",
      "title": "Eine Mitgliedschaft, alle Classic-Mini-DIY-Seiten",
      "price": "Ab 1,99 $/Monat",
      "subtitle": "Abonniere hier oder in den iOS- und Android-Apps – gleicher Preis, gleiche Vorteile überall."
    },
    "benefits": {
      "eyebrow": "WAS DU BEKOMMST",
      "title": "Vorteile für Fördermitglieder",
      "items": {
        "one_account": {
          "title": "Ein Konto für alles",
          "desc": "classicminidiy.com, The Mini Exchange und die Classic Mini DIY Toolbox-Apps. Ein Profil, ein Login und ein Fördermitglied-Abzeichen auf deinem öffentlichen Profil."
        },
        "maintenance": {
          "title": "Wartungsverfolgung",
          "desc": "Garage für mehrere Fahrzeuge, Servicehistorie, intelligente Erinnerungen, PDF-Export, Cloud-Synchronisierung (in den Apps)."
        },
        "discord": {
          "title": "Discord nur für Mitglieder",
          "desc": "Eine private Community zum Fachsimpeln, Projekte teilen und Hilfe holen."
        },
        "listings": {
          "title": "Kostenlose Premium-Anzeigen auf The Mini Exchange",
          "desc": "Das Upgrade auf eine Premium-Anzeige ist kostenlos enthalten, solange deine Mitgliedschaft aktiv ist."
        },
        "support": {
          "title": "Unterstütze den Kanal",
          "desc": "Finanziere die Weiterentwicklung und kostenlose technische Ressourcen für die Classic-Mini-Community."
        }
      }
    },
    "cta": {
      "title": "Fördermitglied werden",
      "subtitle": "Ab 1,99 $/Monat, jederzeit kündbar. Jeder Plan schaltet dieselben Vorteile auf allen Classic-Mini-DIY-Angeboten frei — wähle das DIY-Mini-Bot-Kontingent, das zu dir passt.",
      "checking": "Mitgliedschaft wird geprüft…",
      "activating_title": "Mitgliedschaft wird aktiviert…",
      "activating_body": "Zahlung eingegangen – wir schalten deine Vorteile frei. Das dauert meist nur ein paar Sekunden.",
      "activation_timeout_title": "Dauert länger als erwartet",
      "activation_timeout_body": "Deine Zahlung ist durchgegangen, aber die Aktivierung dauert etwas länger als üblich. Lade diese Seite in einer Minute neu – falls deine Mitgliedschaft dann immer noch nicht aktiv ist, melde dich über die Kontaktseite und wir klären das.",
      "signin": "Zum Mitgliedwerden anmelden",
      "also_apps": "Auch in den iOS- und Android-Apps verfügbar."
    },
    "member": {
      "title_pending": "Du bist Fördermitglied",
      "settings_body": "Verwalten Sie Tarif, Abrechnung und Discord-Zugang in den Einstellungen.",
      "settings_cta": "Mitgliedschaft verwalten"
    },
    "errors": {
      "checkout_title": "Bezahlung nicht verfügbar",
      "checkout_body": "Wir konnten den Bezahlvorgang für deine Mitgliedschaft nicht starten. Bitte versuche es gleich noch einmal.",
      "plan_unavailable": "{plan} ist noch nicht verfügbar. Versuche es bald erneut oder wähle einen anderen Plan."
    },
    "toasts": {
      "subscribed_title": "Willkommen, Fördermitglied!",
      "subscribed_body": "Deine Mitgliedschaft wird gerade aktiviert – deine Vorteile erscheinen in Kürze.",
      "canceled_title": "Bezahlvorgang abgebrochen",
      "canceled_body": "Es wurde nichts abgebucht. Du kannst jederzeit Fördermitglied werden, wenn du so weit bist."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Am beliebtesten",
      "per_month": "/Monat",
      "questions": "{count} DIY-Mini-Bot-Fragen pro Monat",
      "same_benefits": "Alle anderen Vorteile sind bei allen Plänen gleich.",
      "choose": "{plan} wählen"
    }
  },
  "it": {
    "meta": {
      "title": "Socio Sostenitore — Classic Mini DIY",
      "description": "Diventa Socio Sostenitore (da 1,99 $/mese): un solo account per Classic Mini DIY, The Mini Exchange e le app Toolbox, un Discord riservato ai soci, annunci premium gratuiti su The Mini Exchange e il tuo sostegno al canale."
    },
    "hero": {
      "eyebrow": "SOCIO SOSTENITORE",
      "title": "Un'unica iscrizione, tutti i siti Classic Mini DIY",
      "price": "Da $1.99/mese",
      "subtitle": "Iscriviti qui oppure dalle app iOS e Android: stesso prezzo, stessi vantaggi ovunque."
    },
    "benefits": {
      "eyebrow": "COSA OTTIENI",
      "title": "Vantaggi per i Soci Sostenitori",
      "items": {
        "one_account": {
          "title": "Un account per tutto",
          "desc": "classicminidiy.com, The Mini Exchange e le app Classic Mini DIY Toolbox. Un profilo, un accesso e un badge Socio Sostenitore sul tuo profilo pubblico."
        },
        "maintenance": {
          "title": "Monitoraggio della manutenzione",
          "desc": "Garage multiveicolo, storico degli interventi, promemoria intelligenti, esportazione PDF e sincronizzazione cloud (nelle app)."
        },
        "discord": {
          "title": "Discord riservato ai soci",
          "desc": "Una community privata per parlare di meccanica, condividere i progetti e chiedere aiuto."
        },
        "listings": {
          "title": "Annunci premium gratuiti su The Mini Exchange",
          "desc": "Passaggio ad annuncio premium incluso senza costi finché la tua iscrizione è attiva."
        },
        "support": {
          "title": "Sostieni il canale",
          "desc": "Finanzia lo sviluppo continuo e le risorse tecniche gratuite per la community del Classic Mini."
        }
      }
    },
    "cta": {
      "title": "Diventa Socio Sostenitore",
      "subtitle": "Da $1.99/mese, disdici quando vuoi. Ogni piano sblocca gli stessi vantaggi su tutte le proprietà Classic Mini DIY — scegli il limite del DIY Mini Bot che fa per te.",
      "checking": "Verifica dell'iscrizione in corso…",
      "activating_title": "Attivazione dell'iscrizione…",
      "activating_body": "Pagamento ricevuto: stiamo attivando i tuoi vantaggi. Di solito bastano pochi secondi.",
      "activation_timeout_title": "Ci sta mettendo più del previsto",
      "activation_timeout_body": "Il pagamento è andato a buon fine, ma l'attivazione sta richiedendo un po' più del solito. Ricarica questa pagina tra un minuto; se l'iscrizione non risulta ancora attiva, scrivici dalla pagina dei contatti e sistemiamo tutto.",
      "signin": "Accedi per diventare socio",
      "also_apps": "Disponibile anche nelle app iOS e Android."
    },
    "member": {
      "title_pending": "Sei un Socio Sostenitore",
      "settings_body": "Gestisci piano, fatturazione e accesso a Discord nelle Impostazioni.",
      "settings_cta": "Gestisci abbonamento"
    },
    "errors": {
      "checkout_title": "Pagamento non disponibile",
      "checkout_body": "Non siamo riusciti ad avviare il pagamento dell'iscrizione. Riprova tra un momento.",
      "plan_unavailable": "{plan} non è ancora acquistabile. Riprova tra poco o scegli un altro piano."
    },
    "toasts": {
      "subscribed_title": "Benvenuto, Socio Sostenitore!",
      "subscribed_body": "La tua iscrizione si sta attivando: i vantaggi compariranno a breve.",
      "canceled_title": "Pagamento annullato",
      "canceled_body": "Non è stato effettuato alcun addebito. Puoi diventare Socio Sostenitore quando vuoi."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Il più scelto",
      "per_month": "/mese",
      "questions": "{count} domande al DIY Mini Bot al mese",
      "same_benefits": "Tutti gli altri vantaggi sono identici in ogni piano.",
      "choose": "Scegli {plan}"
    }
  },
  "pt": {
    "meta": {
      "title": "Membro Apoiador — Classic Mini DIY",
      "description": "Torne-se Membro Apoiador (a partir de 1,99 $/mês): uma só conta para a Classic Mini DIY, The Mini Exchange e as apps Toolbox, um Discord exclusivo para membros, anúncios premium gratuitos no The Mini Exchange e apoio ao canal."
    },
    "hero": {
      "eyebrow": "MEMBRO APOIADOR",
      "title": "Uma adesão, todos os sites Classic Mini DIY",
      "price": "A partir de $1.99/mês",
      "subtitle": "Subscreva aqui ou nas apps iOS e Android: mesmo preço e mesmas vantagens em todo o lado."
    },
    "benefits": {
      "eyebrow": "O QUE RECEBE",
      "title": "Vantagens de Membro Apoiador",
      "items": {
        "one_account": {
          "title": "Uma conta para tudo",
          "desc": "classicminidiy.com, The Mini Exchange e as apps Classic Mini DIY Toolbox. Um perfil, um início de sessão e um emblema de Membro Apoiador no seu perfil público."
        },
        "maintenance": {
          "title": "Registo de manutenção",
          "desc": "Garagem multiveículo, histórico de intervenções, lembretes inteligentes, exportação em PDF e sincronização na nuvem (nas apps)."
        },
        "discord": {
          "title": "Discord exclusivo para membros",
          "desc": "Uma comunidade privada para falar de mecânica, partilhar projetos e pedir ajuda."
        },
        "listings": {
          "title": "Anúncios premium gratuitos no The Mini Exchange",
          "desc": "Upgrade para anúncio premium incluído sem custos enquanto a sua adesão estiver ativa."
        },
        "support": {
          "title": "Apoie o canal",
          "desc": "Financie o desenvolvimento contínuo e os recursos técnicos gratuitos para a comunidade do Classic Mini."
        }
      }
    },
    "cta": {
      "title": "Torne-se Membro Apoiador",
      "subtitle": "A partir de $1.99/mês, cancele quando quiser. Todos os planos liberam os mesmos benefícios em todas as propriedades Classic Mini DIY — escolha o limite do DIY Mini Bot que combina com você.",
      "checking": "A verificar a sua adesão…",
      "activating_title": "A ativar a sua adesão…",
      "activating_body": "Pagamento recebido — estamos a ligar as suas vantagens. Normalmente demora alguns segundos.",
      "activation_timeout_title": "Está a demorar mais do que o esperado",
      "activation_timeout_body": "O seu pagamento foi concluído, mas a ativação está a demorar um pouco mais do que o habitual. Atualize esta página dentro de um minuto; se a adesão continuar inativa, contacte-nos pela página de contacto e resolvemos.",
      "signin": "Inicie sessão para se tornar membro",
      "also_apps": "Também disponível nas apps iOS e Android."
    },
    "member": {
      "title_pending": "É Membro Apoiador",
      "settings_body": "Gerencie seu plano, a cobrança e o acesso ao Discord em Configurações.",
      "settings_cta": "Gerenciar assinatura"
    },
    "errors": {
      "checkout_title": "Pagamento indisponível",
      "checkout_body": "Não conseguimos iniciar o pagamento da sua adesão. Tente novamente daqui a pouco.",
      "plan_unavailable": "{plan} ainda não está disponível para compra. Tente novamente em breve ou escolha outro plano."
    },
    "toasts": {
      "subscribed_title": "Bem-vindo, Membro Apoiador!",
      "subscribed_body": "A sua adesão está a ser ativada — as vantagens aparecerão em breve.",
      "canceled_title": "Pagamento cancelado",
      "canceled_body": "Não foi feita qualquer cobrança. Pode tornar-se Membro Apoiador quando quiser."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Mais popular",
      "per_month": "/mês",
      "questions": "{count} perguntas ao DIY Mini Bot por mês",
      "same_benefits": "Todos os outros benefícios são iguais em todos os planos.",
      "choose": "Escolher {plan}"
    }
  },
  "ru": {
    "meta": {
      "title": "Постоянный участник — Classic Mini DIY",
      "description": "Станьте постоянным участником (от 1,99 $ в месяц): один аккаунт для Classic Mini DIY, The Mini Exchange и приложений Toolbox, Discord только для участников, бесплатные премиум-объявления на The Mini Exchange и поддержка канала."
    },
    "hero": {
      "eyebrow": "ПОСТОЯННЫЙ УЧАСТНИК",
      "title": "Одно участие — все ресурсы Classic Mini DIY",
      "price": "От $1.99/мес",
      "subtitle": "Оформите подписку здесь или в приложениях для iOS и Android — цена и привилегии везде одинаковые."
    },
    "benefits": {
      "eyebrow": "ЧТО ВЫ ПОЛУЧАЕТЕ",
      "title": "Привилегии постоянного участника",
      "items": {
        "one_account": {
          "title": "Один аккаунт для всего",
          "desc": "classicminidiy.com, The Mini Exchange и приложения Classic Mini DIY Toolbox. Один профиль, один вход и значок постоянного участника в вашем публичном профиле."
        },
        "maintenance": {
          "title": "Учёт обслуживания",
          "desc": "Гараж на несколько машин, история обслуживания, умные напоминания, экспорт в PDF и синхронизация с облаком (в приложениях)."
        },
        "discord": {
          "title": "Discord только для участников",
          "desc": "Закрытое сообщество, где можно обсуждать технику, показывать свои проекты и просить совета."
        },
        "listings": {
          "title": "Бесплатные премиум-объявления на The Mini Exchange",
          "desc": "Повышение объявления до премиум включено бесплатно, пока ваше участие активно."
        },
        "support": {
          "title": "Поддержите канал",
          "desc": "Финансируйте дальнейшую разработку и бесплатные технические материалы для сообщества Classic Mini."
        }
      }
    },
    "cta": {
      "title": "Стать постоянным участником",
      "subtitle": "От $1.99/мес, отмена в любой момент. Каждый план открывает одни и те же преимущества во всех сервисах Classic Mini DIY — выберите лимит DIY Mini Bot, который вам подходит.",
      "checking": "Проверяем ваше участие…",
      "activating_title": "Активируем ваше участие…",
      "activating_body": "Платёж получен — включаем ваши привилегии. Обычно это занимает несколько секунд.",
      "activation_timeout_title": "Занимает больше времени, чем обычно",
      "activation_timeout_body": "Платёж прошёл, но активация занимает чуть больше времени, чем обычно. Обновите страницу через минуту; если участие всё ещё не активно, напишите нам через страницу контактов, и мы всё решим.",
      "signin": "Войдите, чтобы стать участником",
      "also_apps": "Также доступно в приложениях для iOS и Android."
    },
    "member": {
      "title_pending": "Вы постоянный участник",
      "settings_body": "Управляйте тарифом, оплатой и доступом к Discord в настройках.",
      "settings_cta": "Управлять членством"
    },
    "errors": {
      "checkout_title": "Оплата недоступна",
      "checkout_body": "Не удалось начать оплату участия. Попробуйте ещё раз через минуту.",
      "plan_unavailable": "{plan} пока недоступен для покупки. Попробуйте позже или выберите другой план."
    },
    "toasts": {
      "subscribed_title": "Добро пожаловать, постоянный участник!",
      "subscribed_body": "Ваше участие активируется — привилегии появятся совсем скоро.",
      "canceled_title": "Оплата отменена",
      "canceled_body": "Списаний не было. Вы можете стать постоянным участником в любой момент."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "Самый популярный",
      "per_month": "/мес",
      "questions": "{count} вопросов DIY Mini Bot в месяц",
      "same_benefits": "Все остальные преимущества одинаковы для всех планов.",
      "choose": "Выбрать {plan}"
    }
  },
  "ja": {
    "meta": {
      "title": "サステイニングメンバー — Classic Mini DIY",
      "description": "サステイニングメンバー (月額 1.99 ドルから) になると、Classic Mini DIY、The Mini Exchange、Toolbox アプリで使えるひとつのアカウント、メンバー限定 Discord、The Mini Exchange のプレミアム出品無料、そしてチャンネルの支援が可能になります。"
    },
    "hero": {
      "eyebrow": "サステイニングメンバー",
      "title": "ひとつのメンバーシップで、Classic Mini DIY のすべてを",
      "price": "月額 $1.99 から",
      "subtitle": "こちらからでも、iOS・Android アプリからでも登録できます。価格も特典もどこでも同じです。"
    },
    "benefits": {
      "eyebrow": "特典の内容",
      "title": "サステイニングメンバーの特典",
      "items": {
        "one_account": {
          "title": "すべてで使えるひとつのアカウント",
          "desc": "classicminidiy.com、The Mini Exchange、Classic Mini DIY Toolbox アプリ。プロフィールもログインもひとつで、公開プロフィールにサステイニングメンバーのバッジが付きます。"
        },
        "maintenance": {
          "title": "メンテナンス記録",
          "desc": "複数車両のガレージ、整備履歴、スマートリマインダー、PDF 書き出し、クラウド同期 (アプリ内)。"
        },
        "discord": {
          "title": "メンバー限定 Discord",
          "desc": "整備の話をしたり、製作中の車両を共有したり、助けを求めたりできるプライベートなコミュニティ。"
        },
        "listings": {
          "title": "The Mini Exchange のプレミアム出品が無料",
          "desc": "メンバーシップが有効な間、プレミアム出品へのアップグレードが無料で含まれます。"
        },
        "support": {
          "title": "チャンネルを支援する",
          "desc": "Classic Mini コミュニティのための開発の継続と無料の技術資料を支えてください。"
        }
      }
    },
    "cta": {
      "title": "サステイニングメンバーになる",
      "subtitle": "月額 $1.99 から、いつでも解約可能。どのプランでも Classic Mini DIY の全サービスで同じ特典が使えます。DIY Mini Bot の利用回数で選んでください。",
      "checking": "メンバーシップを確認しています…",
      "activating_title": "メンバーシップを有効化しています…",
      "activating_body": "お支払いを受け取りました。特典を有効にしています。通常は数秒で完了します。",
      "activation_timeout_title": "想定より時間がかかっています",
      "activation_timeout_body": "お支払いは完了していますが、有効化にいつもより少し時間がかかっています。1 分ほどしてからこのページを再読み込みしてください。それでもメンバーシップが有効にならない場合は、お問い合わせページからご連絡ください。こちらで対応します。",
      "signin": "サインインしてメンバーになる",
      "also_apps": "iOS・Android アプリでもご利用いただけます。"
    },
    "member": {
      "title_pending": "あなたはサステイニングメンバーです",
      "settings_body": "プラン、請求、Discord へのアクセスは設定で管理できます。",
      "settings_cta": "メンバーシップを管理"
    },
    "errors": {
      "checkout_title": "お支払い手続きを利用できません",
      "checkout_body": "メンバーシップのお支払い手続きを開始できませんでした。しばらくしてからもう一度お試しください。",
      "plan_unavailable": "{plan} はまだ購入できません。しばらくしてから再度お試しいただくか、別のプランをお選びください。"
    },
    "toasts": {
      "subscribed_title": "ようこそ、サステイニングメンバー!",
      "subscribed_body": "メンバーシップを有効化しています。まもなく特典が表示されます。",
      "canceled_title": "お支払いをキャンセルしました",
      "canceled_body": "請求は発生していません。準備ができたらいつでもサステイニングメンバーになれます。"
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "人気",
      "per_month": "/月",
      "questions": "DIY Mini Bot への質問 月{count}件",
      "same_benefits": "その他の特典はすべてのプランで同じです。",
      "choose": "{plan} を選ぶ"
    }
  },
  "zh": {
    "meta": {
      "title": "持续支持会员 — Classic Mini DIY",
      "description": "成为持续支持会员(每月 1.99 美元起):在 Classic Mini DIY、The Mini Exchange 和 Toolbox 应用中共用一个账号,加入会员专属 Discord,获得 The Mini Exchange 免费高级刊登,并支持本频道。"
    },
    "hero": {
      "eyebrow": "持续支持会员",
      "title": "一份会员资格,通行所有 Classic Mini DIY 站点",
      "price": "每月 $1.99 起",
      "subtitle": "可在此订阅,也可在 iOS 和 Android 应用中订阅——价格相同,权益一致。"
    },
    "benefits": {
      "eyebrow": "你将获得",
      "title": "持续支持会员权益",
      "items": {
        "one_account": {
          "title": "一个账号,处处通用",
          "desc": "classicminidiy.com、The Mini Exchange 和 Classic Mini DIY Toolbox 应用。一份资料、一次登录,公开资料上还会显示持续支持会员徽章。"
        },
        "maintenance": {
          "title": "保养记录",
          "desc": "多车库管理、维修历史、智能提醒、PDF 导出、云端同步(应用内)。"
        },
        "discord": {
          "title": "会员专属 Discord",
          "desc": "一个私密社群,聊技术、晒改装、随时求助。"
        },
        "listings": {
          "title": "The Mini Exchange 免费高级刊登",
          "desc": "会员资格有效期间,高级刊登升级免费包含在内。"
        },
        "support": {
          "title": "支持本频道",
          "desc": "为 Classic Mini 社群资助持续开发与免费技术资源。"
        }
      }
    },
    "cta": {
      "title": "成为持续支持会员",
      "subtitle": "每月 $1.99 起，随时取消。所有方案在 Classic Mini DIY 的全部服务中享有相同权益 — 请按 DIY Mini Bot 的用量选择。",
      "checking": "正在检查你的会员资格…",
      "activating_title": "正在激活你的会员资格…",
      "activating_body": "已收到付款——我们正在为你开启权益,通常只需几秒钟。",
      "activation_timeout_title": "耗时比预期长",
      "activation_timeout_body": "你的付款已成功,但激活比平时稍慢一些。请过一分钟后刷新本页;如果会员资格仍未生效,请通过联系页面告诉我们,我们会帮你处理。",
      "signin": "登录以成为会员",
      "also_apps": "iOS 和 Android 应用中同样可用。"
    },
    "member": {
      "title_pending": "你是持续支持会员",
      "settings_body": "在设置中管理您的方案、账单和 Discord 访问权限。",
      "settings_cta": "管理会员"
    },
    "errors": {
      "checkout_title": "暂时无法结账",
      "checkout_body": "我们无法开始你的会员结账流程。请稍后再试。",
      "plan_unavailable": "{plan} 暂时无法购买。请稍后再试或选择其他方案。"
    },
    "toasts": {
      "subscribed_title": "欢迎你,持续支持会员!",
      "subscribed_body": "你的会员资格正在激活——权益稍后就会出现。",
      "canceled_title": "结账已取消",
      "canceled_body": "未产生任何扣款。你随时都可以成为持续支持会员。"
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "最受欢迎",
      "per_month": "/月",
      "questions": "每月 {count} 个 DIY Mini Bot 问题",
      "same_benefits": "其他权益在所有方案中完全相同。",
      "choose": "选择 {plan}"
    }
  },
  "ko": {
    "meta": {
      "title": "서포팅 멤버 — Classic Mini DIY",
      "description": "서포팅 멤버(월 1.99달러부터)가 되시면 Classic Mini DIY, The Mini Exchange, Toolbox 앱에서 쓰는 하나의 계정, 멤버 전용 Discord, The Mini Exchange 프리미엄 매물 무료 등록, 그리고 채널 후원까지 함께하실 수 있습니다."
    },
    "hero": {
      "eyebrow": "서포팅 멤버",
      "title": "멤버십 하나로 Classic Mini DIY 전체를",
      "price": "월 $1.99부터",
      "subtitle": "여기에서도, iOS·Android 앱에서도 구독하실 수 있습니다. 가격도 혜택도 어디서나 같습니다."
    },
    "benefits": {
      "eyebrow": "제공되는 혜택",
      "title": "서포팅 멤버 혜택",
      "items": {
        "one_account": {
          "title": "모든 곳에서 쓰는 하나의 계정",
          "desc": "classicminidiy.com, The Mini Exchange, Classic Mini DIY Toolbox 앱. 프로필도 로그인도 하나이며, 공개 프로필에 서포팅 멤버 배지가 표시됩니다."
        },
        "maintenance": {
          "title": "정비 기록 관리",
          "desc": "여러 차량 차고, 정비 이력, 스마트 알림, PDF 내보내기, 클라우드 동기화(앱에서 제공)."
        },
        "discord": {
          "title": "멤버 전용 Discord",
          "desc": "정비 이야기를 나누고, 작업 중인 차를 공유하고, 도움을 받을 수 있는 비공개 커뮤니티."
        },
        "listings": {
          "title": "The Mini Exchange 프리미엄 매물 무료",
          "desc": "멤버십이 유효한 동안 프리미엄 매물 업그레이드가 무료로 포함됩니다."
        },
        "support": {
          "title": "채널 후원하기",
          "desc": "Classic Mini 커뮤니티를 위한 지속적인 개발과 무료 기술 자료를 지원해 주세요."
        }
      }
    },
    "cta": {
      "title": "서포팅 멤버 되기",
      "subtitle": "월 $1.99부터, 언제든 해지 가능. 모든 플랜은 Classic Mini DIY의 모든 서비스에서 동일한 혜택을 제공합니다 — DIY Mini Bot 사용량에 맞는 플랜을 선택하세요.",
      "checking": "멤버십을 확인하는 중…",
      "activating_title": "멤버십을 활성화하는 중…",
      "activating_body": "결제가 확인되었습니다. 혜택을 켜는 중이며, 보통 몇 초면 끝납니다.",
      "activation_timeout_title": "예상보다 오래 걸리고 있습니다",
      "activation_timeout_body": "결제는 정상 처리되었지만 활성화가 평소보다 조금 오래 걸리고 있습니다. 1분 뒤 이 페이지를 새로고침해 주세요. 그래도 멤버십이 활성화되지 않으면 문의 페이지로 연락 주시면 처리해 드리겠습니다.",
      "signin": "로그인하고 멤버 되기",
      "also_apps": "iOS·Android 앱에서도 이용하실 수 있습니다."
    },
    "member": {
      "title_pending": "서포팅 멤버이십니다",
      "settings_body": "설정에서 플랜, 결제, Discord 접근을 관리하세요.",
      "settings_cta": "멤버십 관리"
    },
    "errors": {
      "checkout_title": "결제를 이용할 수 없습니다",
      "checkout_body": "멤버십 결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "plan_unavailable": "{plan}은 아직 구매할 수 없습니다. 잠시 후 다시 시도하거나 다른 플랜을 선택하세요."
    },
    "toasts": {
      "subscribed_title": "환영합니다, 서포팅 멤버님!",
      "subscribed_body": "멤버십을 활성화하는 중입니다. 곧 혜택이 표시됩니다.",
      "canceled_title": "결제가 취소되었습니다",
      "canceled_body": "청구된 금액은 없습니다. 준비되시면 언제든 서포팅 멤버가 되실 수 있습니다."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      },
      "popular": "인기",
      "per_month": "/월",
      "questions": "월 DIY Mini Bot 질문 {count}개",
      "same_benefits": "그 외 혜택은 모든 플랜에서 동일합니다.",
      "choose": "{plan} 선택"
    }
  }
}
</i18n>
