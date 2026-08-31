<script lang="ts" setup>
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { add: addToast } = useToast();
  const { isAuthenticated, isSustainingMember, user, waitForAuth, fetchUserProfile } = useAuth();

  // Canonical 6-benefit list (keystone §4). Order is part of the contract — do
  // not reorder. Copy lives in the i18n block below, verbatim from the keystone.
  const benefits = [
    { icon: 'fas fa-user', key: 'one_account' },
    { icon: 'fas fa-screwdriver-wrench', key: 'maintenance' },
    { icon: 'fab fa-discord', key: 'discord' },
    { icon: 'fas fa-book-open', key: 'blog' },
    { icon: 'fas fa-tag', key: 'listings' },
    { icon: 'fas fa-hand-holding-heart', key: 'support' },
  ];

  const blogUrl = computed(() => (config.public.blogUrl as string) || '');

  const authReady = ref(false);
  const checkoutLoading = ref(false);

  // Logged-out subscribe intent (pre-launch punch list D1): route the visitor
  // through sign-in with the intent preserved as ?subscribe=1, so after auth
  // they land back here and checkout auto-starts (see onMounted). The login
  // page persists the redirect across the OAuth/magic-link round trip.
  const SUBSCRIBE_INTENT_PATH = '/membership?subscribe=1';
  const loginWithIntentHref = `/login?redirect=${encodeURIComponent(SUBSCRIBE_INTENT_PATH)}`;

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
  async function subscribe() {
    if (!isAuthenticated.value) {
      navigateTo(loginWithIntentHref);
      return;
    }
    checkoutLoading.value = true;
    track('membership_checkout_started', { source: 'web' });
    try {
      const token = await getAccessToken();
      if (!token) {
        // Session evaporated between the auth check and checkout — send them
        // back through sign-in with the subscribe intent preserved.
        navigateTo(loginWithIntentHref);
        return;
      }
      const res = await $fetch<{ url?: string }>('/api/membership/checkout', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res?.url) throw new Error('Missing checkout URL');
      await navigateTo(res.url, { external: true });
    } catch (error) {
      console.error('Membership checkout failed:', error);
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

  // Existing web members self-manage through the Stripe Customer Portal (no-code
  // login link, NUXT_PUBLIC_STRIPE_PORTAL_URL). Pre-fill the member's email so
  // they skip a step. Members who subscribed in the iOS/Android apps manage
  // through the App Store / Google Play instead.
  const portalHref = computed(() => {
    const base = (config.public.stripePortalUrl as string) || '';
    if (!base) return '';
    const email = user.value?.email;
    return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
  });

  // Live Discord connection status for members. Reads the user's own
  // discord_links row via the SELECT-own RLS policy (keystone §6.2). null = no
  // link yet; otherwise 'pending' | 'active' | 'revoked' | 'failed'.
  const discordStatus = ref<string | null>(null);
  async function loadDiscordStatus() {
    if (!user.value) return;
    try {
      const { data, error } = await supabase
        .from('discord_links')
        .select('status')
        .eq('user_id', user.value.id)
        .maybeSingle();
      if (error) {
        // PostgREST errors don't throw — surface them explicitly (RLS/db issues).
        console.error('Error loading Discord status:', error);
        discordStatus.value = null;
        return;
      }
      discordStatus.value = data?.status ?? null;
    } catch (err) {
      console.error('Error loading Discord status:', err);
      discordStatus.value = null;
    }
  }

  // Which channel grants this member's entitlement (apple/google/stripe/comp),
  // via get_my_membership(). Drives the management UI so non-Stripe members
  // aren't shown the Stripe portal link. null while loading or if the RPC isn't
  // deployed yet — in which case we hide the Stripe link (the safe default for
  // comp/Apple/Google members).
  const membershipPlatform = ref<string | null>(null);
  async function loadMembershipPlatform() {
    if (!user.value) return;
    try {
      // Cast the RPC name until types/database.ts is regenerated post-deploy.
      const { data, error } = await supabase.rpc('get_my_membership' as any).single();
      if (error) {
        console.error('Error loading membership platform:', error);
        return;
      }
      membershipPlatform.value = (data as { platform?: string | null })?.platform ?? null;
    } catch (err) {
      console.error('Error loading membership platform:', err);
    }
  }

  const discordStatusKey = computed(() => {
    switch (discordStatus.value) {
      case 'active':
        return 'connected';
      case 'pending':
        return 'pending';
      case 'revoked':
        return 'revoked';
      case 'failed':
        return 'failed';
      default:
        return 'not_connected';
    }
  });
  const discordStatusLabel = computed(() => t(`member.discord_status.${discordStatusKey.value}`));
  const discordGuidance = computed(() => t(`member.discord_guidance.${discordStatusKey.value}`));
  const discordBadgeClass = computed(() => {
    switch (discordStatus.value) {
      case 'active':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'revoked':
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  });

  // Load Discord + platform whenever membership is active — covers both an
  // existing member on mount and a user whose status flips true after the
  // checkout webhook resolves (immediate runs once with the current value).
  watch(
    isSustainingMember,
    (active) => {
      if (active) {
        loadDiscordStatus();
        loadMembershipPlatform();
      }
    },
    { immediate: true }
  );

  onMounted(async () => {
    await waitForAuth();
    authReady.value = true;

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
      const { subscribed: _subscribed, canceled: _canceled, subscribe: _subscribe, ...rest } = route.query;
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

        <!-- Active member: management + your-benefits area -->
        <section v-else-if="isSustainingMember" class="card bg-base-100 border border-primary/40 shadow-md">
          <div class="card-body">
            <div class="flex flex-wrap items-center gap-3">
              <ProfileSustainingBadge size="md" />
              <h2 class="text-2xl font-bold">{{ t('member.title') }}</h2>
            </div>
            <p class="opacity-70">{{ t('member.subtitle') }}</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <!-- Discord connection status (live via discord_links SELECT-own
                   RLS policy, keystone §6.2) -->
              <div class="rounded-box border border-base-300 p-4">
                <p class="font-semibold">
                  <i class="fab fa-discord mr-2 text-primary"></i>{{ t('member.discord_title') }}
                  <span class="badge badge-sm ml-1" :class="discordBadgeClass">{{ discordStatusLabel }}</span>
                </p>
                <p class="text-sm opacity-70 mt-1">{{ discordGuidance }}</p>
                <!-- No self-serve re-issue endpoint exists yet (backend
                     follow-up); until then, support re-sends invites manually. -->
                <p
                  v-if="discordStatusKey === 'pending' || discordStatusKey === 'not_connected'"
                  class="text-xs opacity-60 mt-2"
                >
                  {{ t('member.discord_lost_email') }}
                  <NuxtLink to="/contact" class="link link-primary">{{ t('member.discord_contact_cta') }}</NuxtLink>
                </p>
              </div>
              <!-- Pro blog access -->
              <div class="rounded-box border border-base-300 p-4">
                <p class="font-semibold">
                  <i class="fas fa-book-open mr-2 text-primary"></i>{{ t('member.blog_title') }}
                </p>
                <p class="text-sm opacity-70 mt-1">{{ t('member.blog_desc') }}</p>
                <a
                  v-if="blogUrl"
                  :href="blogUrl"
                  target="_blank"
                  rel="noopener"
                  class="link link-primary text-sm font-semibold mt-2 inline-block"
                >
                  {{ t('member.blog_cta') }} <i class="fas fa-arrow-up-right-from-square ml-1 text-xs"></i>
                </a>
              </div>
            </div>

            <!-- Management action is per-channel: only Stripe members have a
                 billing portal; comp/Apple/Google members must not see it. -->
            <template v-if="membershipPlatform === 'stripe'">
              <div v-if="portalHref" class="card-actions mt-4">
                <a
                  :href="portalHref"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-outline btn-primary"
                  @click="track('membership_portal_opened', { source: 'web' })"
                >
                  <i class="fas fa-gear"></i>
                  {{ t('member.manage') }}
                </a>
              </div>
              <p class="text-xs opacity-60 mt-2">{{ t('member.manage_note_stripe') }}</p>
            </template>
            <p v-else-if="membershipPlatform === 'comp'" class="text-sm opacity-70 mt-4">
              <i class="fas fa-gift mr-2 text-primary"></i>{{ t('member.comp_note') }}
            </p>
            <p
              v-else-if="membershipPlatform === 'apple' || membershipPlatform === 'google'"
              class="text-sm opacity-70 mt-4"
            >
              <i class="fas fa-mobile-screen mr-2 text-primary"></i>{{ t('member.manage_note_store') }}
            </p>
            <p v-else-if="membershipPlatform === 'ghost'" class="text-sm opacity-70 mt-4">
              <i class="fas fa-book-open mr-2 text-primary"></i>{{ t('member.manage_note_ghost') }}
            </p>
            <p v-else-if="membershipPlatform === 'patreon'" class="text-sm opacity-70 mt-4">
              <i class="fab fa-patreon mr-2 text-primary"></i>
              <a
                href="https://www.patreon.com/settings/memberships"
                target="_blank"
                rel="noopener"
                class="link link-primary"
                >{{ t('member.manage_note_patreon') }}</a
              >
            </p>
            <!-- Unknown/null platform on an active member: never render an
                 empty manage area (parity with TME). -->
            <p v-else class="text-sm opacity-70 mt-4">
              <i class="fas fa-circle-check mr-2 text-success"></i>{{ t('member.active_fallback') }}
            </p>
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

            <div class="mt-4">
              <button
                v-if="isAuthenticated"
                class="btn btn-primary btn-lg"
                :disabled="checkoutLoading"
                @click="subscribe"
              >
                <i v-if="checkoutLoading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-star"></i>
                {{ t('cta.subscribe') }}
              </button>
              <NuxtLink v-else :to="loginWithIntentHref" class="btn btn-primary btn-lg">
                <i class="fas fa-right-to-bracket"></i>
                {{ t('cta.signin') }}
              </NuxtLink>
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

      <!-- Patreon disambiguation: membership is not the tip jar -->
      <p class="text-center text-sm opacity-60">
        {{ t('tip_jar_note') }}
        <NuxtLink to="/" class="link">{{ t('tip_jar_link') }}</NuxtLink>
      </p>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Sustaining Member — Classic Mini DIY",
      "description": "Become a Sustaining Member ($1.99/month) for one account across Classic Mini DIY, The Mini Exchange, and the Toolbox apps, a members-only Discord, Pro blog access, free premium listings on The Mini Exchange, and to support the channel."
    },
    "hero": {
      "eyebrow": "SUSTAINING MEMBER",
      "title": "One membership, every Classic Mini DIY property",
      "price": "$1.99/month",
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
        "blog": {
          "title": "Pro access to the blog",
          "desc": "Complimentary access to subscriber content on the Classic Mini DIY blog."
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
      "subtitle": "$1.99/month, cancel anytime. Your membership unlocks benefits across every Classic Mini DIY property.",
      "checking": "Checking your membership…",
      "activating_title": "Activating your membership…",
      "activating_body": "Payment received — we're switching on your benefits. This usually takes a few seconds.",
      "activation_timeout_title": "Taking longer than expected",
      "activation_timeout_body": "Your payment went through, but activation is taking a little longer than usual. Refresh this page in a minute — if your membership still isn't active, reach out via the contact page and we'll sort it out.",
      "subscribe": "Become a Sustaining Member — $1.99/mo",
      "signin": "Sign in to become a member",
      "also_apps": "Also available in the iOS and Android apps."
    },
    "member": {
      "title": "You're a Sustaining Member",
      "subtitle": "Thanks for keeping the Classic Mini community running. Here's what your membership unlocks.",
      "discord_title": "Members-only Discord",
      "discord_status": {
        "connected": "Connected",
        "pending": "Invite sent",
        "revoked": "Revoked",
        "failed": "Needs attention",
        "not_connected": "Not connected"
      },
      "discord_guidance": {
        "connected": "You're in the members-only Discord — see you there!",
        "pending": "Your private invite was emailed to you — check your inbox (and spam) to finish joining.",
        "not_connected": "We email your private Discord invite once your membership is active. It can take a few minutes — watch your inbox (and spam).",
        "revoked": "Your Discord access was removed. Reactivate your membership to rejoin.",
        "failed": "We hit a snag issuing your Discord invite. Reach out via the contact page and we'll sort it out."
      },
      "blog_title": "Pro access to the blog",
      "blog_desc": "Complimentary access to subscriber content on the Classic Mini DIY blog.",
      "blog_cta": "Open the blog",
      "discord_lost_email": "Lost the invite email?",
      "discord_contact_cta": "Contact us and we'll resend it.",
      "manage": "Manage membership",
      "manage_note_stripe": "Manage or cancel your membership any time through Stripe.",
      "comp_note": "Your membership is complimentary — enjoy all the benefits, on us. There's nothing to manage.",
      "manage_note_store": "Manage or cancel your subscription in the App Store or Google Play, wherever you subscribed.",
      "manage_note_ghost": "Manage your membership through your Ghost account billing email.",
      "manage_note_patreon": "Manage your pledge on Patreon.",
      "active_fallback": "Your membership is active."
    },
    "errors": {
      "checkout_title": "Checkout unavailable",
      "checkout_body": "We couldn't start your membership checkout. Please try again in a moment."
    },
    "toasts": {
      "subscribed_title": "Welcome, Sustaining Member!",
      "subscribed_body": "Your membership is being activated — your benefits will appear shortly.",
      "canceled_title": "Checkout canceled",
      "canceled_body": "No charge was made. You can become a Sustaining Member whenever you're ready."
    },
    "tip_jar_note": "Looking to leave a one-time tip instead? Patreon is a separate tip jar.",
    "tip_jar_link": "See ways to support →"
  },
  "es": {
    "meta": {
      "title": "Socio Colaborador — Classic Mini DIY",
      "description": "Hazte Socio Colaborador (1,99 $/mes) y consigue una sola cuenta para Classic Mini DIY, The Mini Exchange y las apps Toolbox, un Discord exclusivo para socios, acceso Pro al blog, anuncios premium gratis en The Mini Exchange y apoya al canal."
    },
    "hero": {
      "eyebrow": "SOCIO COLABORADOR",
      "title": "Una membresía, todos los sitios de Classic Mini DIY",
      "price": "1,99 $/mes",
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
        "blog": {
          "title": "Acceso Pro al blog",
          "desc": "Acceso gratuito al contenido para suscriptores del blog de Classic Mini DIY."
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
      "subtitle": "1,99 $/mes, cancela cuando quieras. Tu membresía desbloquea ventajas en todos los sitios de Classic Mini DIY.",
      "checking": "Comprobando tu membresía…",
      "activating_title": "Activando tu membresía…",
      "activating_body": "Pago recibido: estamos activando tus ventajas. Suele tardar unos segundos.",
      "activation_timeout_title": "Está tardando más de lo previsto",
      "activation_timeout_body": "Tu pago se ha completado, pero la activación está tardando algo más de lo normal. Actualiza esta página en un minuto; si tu membresía sigue sin estar activa, escríbenos desde la página de contacto y lo solucionamos.",
      "subscribe": "Hazte Socio Colaborador — 1,99 $/mes",
      "signin": "Inicia sesión para hacerte socio",
      "also_apps": "También disponible en las apps de iOS y Android."
    },
    "member": {
      "title": "Eres Socio Colaborador",
      "subtitle": "Gracias por mantener viva la comunidad del Classic Mini. Esto es lo que desbloquea tu membresía.",
      "discord_title": "Discord exclusivo para socios",
      "discord_status": {
        "connected": "Conectado",
        "pending": "Invitación enviada",
        "revoked": "Revocado",
        "failed": "Requiere atención",
        "not_connected": "Sin conectar"
      },
      "discord_guidance": {
        "connected": "Ya estás en el Discord exclusivo: ¡nos vemos allí!",
        "pending": "Te hemos enviado tu invitación privada por correo: revisa tu bandeja de entrada (y el spam) para terminar de entrar.",
        "not_connected": "Te enviamos tu invitación privada de Discord por correo en cuanto tu membresía esté activa. Puede tardar unos minutos: vigila tu bandeja de entrada (y el spam).",
        "revoked": "Se ha retirado tu acceso a Discord. Reactiva tu membresía para volver a entrar.",
        "failed": "Hemos tenido un problema al emitir tu invitación de Discord. Escríbenos desde la página de contacto y lo solucionamos."
      },
      "blog_title": "Acceso Pro al blog",
      "blog_desc": "Acceso gratuito al contenido para suscriptores del blog de Classic Mini DIY.",
      "blog_cta": "Abrir el blog",
      "discord_lost_email": "¿Has perdido el correo de invitación?",
      "discord_contact_cta": "Contáctanos y te lo reenviamos.",
      "manage": "Gestionar membresía",
      "manage_note_stripe": "Gestiona o cancela tu membresía cuando quieras a través de Stripe.",
      "comp_note": "Tu membresía es de cortesía: disfruta de todas las ventajas, invita la casa. No hay nada que gestionar.",
      "manage_note_store": "Gestiona o cancela tu suscripción en la App Store o en Google Play, según dónde te suscribieras.",
      "manage_note_ghost": "Gestiona tu membresía con el correo de facturación de tu cuenta de Ghost.",
      "manage_note_patreon": "Gestiona tu aportación en Patreon.",
      "active_fallback": "Tu membresía está activa."
    },
    "errors": {
      "checkout_title": "Pago no disponible",
      "checkout_body": "No hemos podido iniciar el pago de tu membresía. Inténtalo de nuevo en un momento."
    },
    "toasts": {
      "subscribed_title": "¡Bienvenido, Socio Colaborador!",
      "subscribed_body": "Tu membresía se está activando: tus ventajas aparecerán en breve.",
      "canceled_title": "Pago cancelado",
      "canceled_body": "No se ha realizado ningún cargo. Puedes hacerte Socio Colaborador cuando quieras."
    },
    "tip_jar_note": "¿Prefieres dejar una propina puntual? Patreon es un bote de propinas aparte.",
    "tip_jar_link": "Ver formas de apoyar →"
  },
  "fr": {
    "meta": {
      "title": "Membre de soutien — Classic Mini DIY",
      "description": "Devenez membre de soutien (1,99 $/mois) : un seul compte pour Classic Mini DIY, The Mini Exchange et les applis Toolbox, un Discord réservé aux membres, l'accès Pro au blog, des annonces premium gratuites sur The Mini Exchange, et un soutien à la chaîne."
    },
    "hero": {
      "eyebrow": "MEMBRE DE SOUTIEN",
      "title": "Une adhésion, tous les sites Classic Mini DIY",
      "price": "1,99 $/mois",
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
        "blog": {
          "title": "Accès Pro au blog",
          "desc": "Accès offert au contenu réservé aux abonnés du blog Classic Mini DIY."
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
      "subtitle": "1,99 $/mois, annulable à tout moment. Votre adhésion débloque des avantages sur tous les sites Classic Mini DIY.",
      "checking": "Vérification de votre adhésion…",
      "activating_title": "Activation de votre adhésion…",
      "activating_body": "Paiement reçu — nous activons vos avantages. Cela prend généralement quelques secondes.",
      "activation_timeout_title": "Cela prend plus de temps que prévu",
      "activation_timeout_body": "Votre paiement est bien passé, mais l'activation prend un peu plus de temps que d'habitude. Actualisez cette page dans une minute ; si votre adhésion n'est toujours pas active, écrivez-nous via la page de contact et nous réglerons ça.",
      "subscribe": "Devenir membre de soutien — 1,99 $/mois",
      "signin": "Connectez-vous pour devenir membre",
      "also_apps": "Également disponible dans les applis iOS et Android."
    },
    "member": {
      "title": "Vous êtes membre de soutien",
      "subtitle": "Merci de faire vivre la communauté Classic Mini. Voici ce que votre adhésion débloque.",
      "discord_title": "Discord réservé aux membres",
      "discord_status": {
        "connected": "Connecté",
        "pending": "Invitation envoyée",
        "revoked": "Révoqué",
        "failed": "À vérifier",
        "not_connected": "Non connecté"
      },
      "discord_guidance": {
        "connected": "Vous êtes dans le Discord réservé aux membres — à tout de suite !",
        "pending": "Votre invitation privée vous a été envoyée par e-mail — vérifiez votre boîte de réception (et vos spams) pour finaliser.",
        "not_connected": "Nous vous envoyons votre invitation Discord privée par e-mail dès que votre adhésion est active. Cela peut prendre quelques minutes — surveillez votre boîte de réception (et vos spams).",
        "revoked": "Votre accès Discord a été retiré. Réactivez votre adhésion pour revenir.",
        "failed": "Nous avons rencontré un problème en émettant votre invitation Discord. Écrivez-nous via la page de contact et nous réglerons ça."
      },
      "blog_title": "Accès Pro au blog",
      "blog_desc": "Accès offert au contenu réservé aux abonnés du blog Classic Mini DIY.",
      "blog_cta": "Ouvrir le blog",
      "discord_lost_email": "Vous avez perdu l'e-mail d'invitation ?",
      "discord_contact_cta": "Contactez-nous, nous le renverrons.",
      "manage": "Gérer l'adhésion",
      "manage_note_stripe": "Gérez ou annulez votre adhésion à tout moment via Stripe.",
      "comp_note": "Votre adhésion est offerte — profitez de tous les avantages, c'est cadeau. Il n'y a rien à gérer.",
      "manage_note_store": "Gérez ou annulez votre abonnement dans l'App Store ou sur Google Play, selon l'endroit où vous vous êtes abonné.",
      "manage_note_ghost": "Gérez votre adhésion via l'e-mail de facturation de votre compte Ghost.",
      "manage_note_patreon": "Gérez votre contribution sur Patreon.",
      "active_fallback": "Votre adhésion est active."
    },
    "errors": {
      "checkout_title": "Paiement indisponible",
      "checkout_body": "Nous n'avons pas pu lancer le paiement de votre adhésion. Réessayez dans un instant."
    },
    "toasts": {
      "subscribed_title": "Bienvenue, membre de soutien !",
      "subscribed_body": "Votre adhésion est en cours d'activation — vos avantages apparaîtront sous peu.",
      "canceled_title": "Paiement annulé",
      "canceled_body": "Aucun débit n'a été effectué. Vous pourrez devenir membre de soutien quand vous le souhaiterez."
    },
    "tip_jar_note": "Vous préférez laisser un pourboire ponctuel ? Patreon est une cagnotte distincte.",
    "tip_jar_link": "Voir comment soutenir →"
  },
  "de": {
    "meta": {
      "title": "Fördermitglied — Classic Mini DIY",
      "description": "Werde Fördermitglied (1,99 $/Monat): ein Konto für Classic Mini DIY, The Mini Exchange und die Toolbox-Apps, ein Discord nur für Mitglieder, Pro-Zugang zum Blog, kostenlose Premium-Anzeigen auf The Mini Exchange – und Unterstützung für den Kanal."
    },
    "hero": {
      "eyebrow": "FÖRDERMITGLIED",
      "title": "Eine Mitgliedschaft, alle Classic-Mini-DIY-Seiten",
      "price": "1,99 $/Monat",
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
        "blog": {
          "title": "Pro-Zugang zum Blog",
          "desc": "Kostenloser Zugang zu den Abonnenteninhalten im Classic-Mini-DIY-Blog."
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
      "subtitle": "1,99 $/Monat, jederzeit kündbar. Deine Mitgliedschaft schaltet Vorteile auf allen Classic-Mini-DIY-Seiten frei.",
      "checking": "Mitgliedschaft wird geprüft…",
      "activating_title": "Mitgliedschaft wird aktiviert…",
      "activating_body": "Zahlung eingegangen – wir schalten deine Vorteile frei. Das dauert meist nur ein paar Sekunden.",
      "activation_timeout_title": "Dauert länger als erwartet",
      "activation_timeout_body": "Deine Zahlung ist durchgegangen, aber die Aktivierung dauert etwas länger als üblich. Lade diese Seite in einer Minute neu – falls deine Mitgliedschaft dann immer noch nicht aktiv ist, melde dich über die Kontaktseite und wir klären das.",
      "subscribe": "Fördermitglied werden — 1,99 $/Monat",
      "signin": "Zum Mitgliedwerden anmelden",
      "also_apps": "Auch in den iOS- und Android-Apps verfügbar."
    },
    "member": {
      "title": "Du bist Fördermitglied",
      "subtitle": "Danke, dass du die Classic-Mini-Community am Laufen hältst. Das schaltet deine Mitgliedschaft frei.",
      "discord_title": "Discord nur für Mitglieder",
      "discord_status": {
        "connected": "Verbunden",
        "pending": "Einladung gesendet",
        "revoked": "Entzogen",
        "failed": "Erfordert Aufmerksamkeit",
        "not_connected": "Nicht verbunden"
      },
      "discord_guidance": {
        "connected": "Du bist im Discord nur für Mitglieder – bis gleich!",
        "pending": "Deine private Einladung ist per E-Mail unterwegs – sieh in deinem Postfach (und im Spam) nach, um beizutreten.",
        "not_connected": "Wir senden dir deine private Discord-Einladung per E-Mail, sobald deine Mitgliedschaft aktiv ist. Das kann ein paar Minuten dauern – behalte dein Postfach (und den Spam) im Auge.",
        "revoked": "Dein Discord-Zugang wurde entfernt. Reaktiviere deine Mitgliedschaft, um wieder beizutreten.",
        "failed": "Beim Ausstellen deiner Discord-Einladung gab es ein Problem. Melde dich über die Kontaktseite und wir klären das."
      },
      "blog_title": "Pro-Zugang zum Blog",
      "blog_desc": "Kostenloser Zugang zu den Abonnenteninhalten im Classic-Mini-DIY-Blog.",
      "blog_cta": "Blog öffnen",
      "discord_lost_email": "Einladungs-E-Mail verloren?",
      "discord_contact_cta": "Kontaktiere uns, wir senden sie erneut.",
      "manage": "Mitgliedschaft verwalten",
      "manage_note_stripe": "Verwalte oder kündige deine Mitgliedschaft jederzeit über Stripe.",
      "comp_note": "Deine Mitgliedschaft ist ein Geschenk – genieße alle Vorteile, geht aufs Haus. Es gibt nichts zu verwalten.",
      "manage_note_store": "Verwalte oder kündige dein Abo im App Store oder bei Google Play – dort, wo du es abgeschlossen hast.",
      "manage_note_ghost": "Verwalte deine Mitgliedschaft über die Rechnungs-E-Mail deines Ghost-Kontos.",
      "manage_note_patreon": "Verwalte deinen Beitrag auf Patreon.",
      "active_fallback": "Deine Mitgliedschaft ist aktiv."
    },
    "errors": {
      "checkout_title": "Bezahlung nicht verfügbar",
      "checkout_body": "Wir konnten den Bezahlvorgang für deine Mitgliedschaft nicht starten. Bitte versuche es gleich noch einmal."
    },
    "toasts": {
      "subscribed_title": "Willkommen, Fördermitglied!",
      "subscribed_body": "Deine Mitgliedschaft wird gerade aktiviert – deine Vorteile erscheinen in Kürze.",
      "canceled_title": "Bezahlvorgang abgebrochen",
      "canceled_body": "Es wurde nichts abgebucht. Du kannst jederzeit Fördermitglied werden, wenn du so weit bist."
    },
    "tip_jar_note": "Lieber einmalig etwas geben? Patreon ist ein separates Trinkgeldglas.",
    "tip_jar_link": "Wege zu unterstützen ansehen →"
  },
  "it": {
    "meta": {
      "title": "Socio Sostenitore — Classic Mini DIY",
      "description": "Diventa Socio Sostenitore (1,99 $/mese): un solo account per Classic Mini DIY, The Mini Exchange e le app Toolbox, un Discord riservato ai soci, accesso Pro al blog, annunci premium gratuiti su The Mini Exchange e il tuo sostegno al canale."
    },
    "hero": {
      "eyebrow": "SOCIO SOSTENITORE",
      "title": "Un'unica iscrizione, tutti i siti Classic Mini DIY",
      "price": "1,99 $/mese",
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
        "blog": {
          "title": "Accesso Pro al blog",
          "desc": "Accesso gratuito ai contenuti riservati agli abbonati del blog Classic Mini DIY."
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
      "subtitle": "1,99 $/mese, disdici quando vuoi. La tua iscrizione sblocca vantaggi su tutti i siti Classic Mini DIY.",
      "checking": "Verifica dell'iscrizione in corso…",
      "activating_title": "Attivazione dell'iscrizione…",
      "activating_body": "Pagamento ricevuto: stiamo attivando i tuoi vantaggi. Di solito bastano pochi secondi.",
      "activation_timeout_title": "Ci sta mettendo più del previsto",
      "activation_timeout_body": "Il pagamento è andato a buon fine, ma l'attivazione sta richiedendo un po' più del solito. Ricarica questa pagina tra un minuto; se l'iscrizione non risulta ancora attiva, scrivici dalla pagina dei contatti e sistemiamo tutto.",
      "subscribe": "Diventa Socio Sostenitore — 1,99 $/mese",
      "signin": "Accedi per diventare socio",
      "also_apps": "Disponibile anche nelle app iOS e Android."
    },
    "member": {
      "title": "Sei un Socio Sostenitore",
      "subtitle": "Grazie per tenere viva la community del Classic Mini. Ecco cosa sblocca la tua iscrizione.",
      "discord_title": "Discord riservato ai soci",
      "discord_status": {
        "connected": "Collegato",
        "pending": "Invito inviato",
        "revoked": "Revocato",
        "failed": "Richiede attenzione",
        "not_connected": "Non collegato"
      },
      "discord_guidance": {
        "connected": "Sei nel Discord riservato ai soci: ci vediamo lì!",
        "pending": "Ti abbiamo inviato per email il tuo invito privato: controlla la posta in arrivo (e lo spam) per completare l'ingresso.",
        "not_connected": "Ti inviamo per email l'invito privato a Discord non appena la tua iscrizione è attiva. Possono volerci alcuni minuti: tieni d'occhio la posta in arrivo (e lo spam).",
        "revoked": "Il tuo accesso a Discord è stato rimosso. Riattiva l'iscrizione per rientrare.",
        "failed": "Abbiamo avuto un problema nell'emettere il tuo invito a Discord. Scrivici dalla pagina dei contatti e sistemiamo tutto."
      },
      "blog_title": "Accesso Pro al blog",
      "blog_desc": "Accesso gratuito ai contenuti riservati agli abbonati del blog Classic Mini DIY.",
      "blog_cta": "Apri il blog",
      "discord_lost_email": "Hai perso l'email di invito?",
      "discord_contact_cta": "Contattaci e te la rinviamo.",
      "manage": "Gestisci l'iscrizione",
      "manage_note_stripe": "Gestisci o disdici la tua iscrizione quando vuoi tramite Stripe.",
      "comp_note": "La tua iscrizione è offerta da noi: goditi tutti i vantaggi, offre la casa. Non c'è nulla da gestire.",
      "manage_note_store": "Gestisci o disdici l'abbonamento nell'App Store o su Google Play, dove ti sei iscritto.",
      "manage_note_ghost": "Gestisci l'iscrizione tramite l'email di fatturazione del tuo account Ghost.",
      "manage_note_patreon": "Gestisci il tuo contributo su Patreon.",
      "active_fallback": "La tua iscrizione è attiva."
    },
    "errors": {
      "checkout_title": "Pagamento non disponibile",
      "checkout_body": "Non siamo riusciti ad avviare il pagamento dell'iscrizione. Riprova tra un momento."
    },
    "toasts": {
      "subscribed_title": "Benvenuto, Socio Sostenitore!",
      "subscribed_body": "La tua iscrizione si sta attivando: i vantaggi compariranno a breve.",
      "canceled_title": "Pagamento annullato",
      "canceled_body": "Non è stato effettuato alcun addebito. Puoi diventare Socio Sostenitore quando vuoi."
    },
    "tip_jar_note": "Preferisci lasciare una mancia una tantum? Patreon è un salvadanaio separato.",
    "tip_jar_link": "Scopri come sostenerci →"
  },
  "pt": {
    "meta": {
      "title": "Membro Apoiador — Classic Mini DIY",
      "description": "Torne-se Membro Apoiador (1,99 $/mês): uma só conta para a Classic Mini DIY, The Mini Exchange e as apps Toolbox, um Discord exclusivo para membros, acesso Pro ao blogue, anúncios premium gratuitos no The Mini Exchange e apoio ao canal."
    },
    "hero": {
      "eyebrow": "MEMBRO APOIADOR",
      "title": "Uma adesão, todos os sites Classic Mini DIY",
      "price": "1,99 $/mês",
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
        "blog": {
          "title": "Acesso Pro ao blogue",
          "desc": "Acesso gratuito aos conteúdos para subscritores do blogue Classic Mini DIY."
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
      "subtitle": "1,99 $/mês, cancele quando quiser. A sua adesão desbloqueia vantagens em todos os sites Classic Mini DIY.",
      "checking": "A verificar a sua adesão…",
      "activating_title": "A ativar a sua adesão…",
      "activating_body": "Pagamento recebido — estamos a ligar as suas vantagens. Normalmente demora alguns segundos.",
      "activation_timeout_title": "Está a demorar mais do que o esperado",
      "activation_timeout_body": "O seu pagamento foi concluído, mas a ativação está a demorar um pouco mais do que o habitual. Atualize esta página dentro de um minuto; se a adesão continuar inativa, contacte-nos pela página de contacto e resolvemos.",
      "subscribe": "Torne-se Membro Apoiador — 1,99 $/mês",
      "signin": "Inicie sessão para se tornar membro",
      "also_apps": "Também disponível nas apps iOS e Android."
    },
    "member": {
      "title": "É Membro Apoiador",
      "subtitle": "Obrigado por manter a comunidade do Classic Mini a andar. Eis o que a sua adesão desbloqueia.",
      "discord_title": "Discord exclusivo para membros",
      "discord_status": {
        "connected": "Ligado",
        "pending": "Convite enviado",
        "revoked": "Revogado",
        "failed": "Precisa de atenção",
        "not_connected": "Não ligado"
      },
      "discord_guidance": {
        "connected": "Já está no Discord exclusivo para membros — até já!",
        "pending": "Enviámos o seu convite privado por email — veja a caixa de entrada (e o spam) para concluir a entrada.",
        "not_connected": "Enviamos o seu convite privado do Discord por email assim que a adesão estiver ativa. Pode demorar alguns minutos — fique atento à caixa de entrada (e ao spam).",
        "revoked": "O seu acesso ao Discord foi removido. Reative a adesão para voltar a entrar.",
        "failed": "Tivemos um problema ao emitir o seu convite do Discord. Contacte-nos pela página de contacto e resolvemos."
      },
      "blog_title": "Acesso Pro ao blogue",
      "blog_desc": "Acesso gratuito aos conteúdos para subscritores do blogue Classic Mini DIY.",
      "blog_cta": "Abrir o blogue",
      "discord_lost_email": "Perdeu o email do convite?",
      "discord_contact_cta": "Contacte-nos e reenviamos.",
      "manage": "Gerir adesão",
      "manage_note_stripe": "Faça a gestão ou cancele a sua adesão a qualquer momento através do Stripe.",
      "comp_note": "A sua adesão é oferecida — aproveite todas as vantagens, é por nossa conta. Não há nada a gerir.",
      "manage_note_store": "Faça a gestão ou cancele a subscrição na App Store ou no Google Play, onde a tiver feito.",
      "manage_note_ghost": "Faça a gestão da adesão através do email de faturação da sua conta Ghost.",
      "manage_note_patreon": "Faça a gestão do seu contributo no Patreon.",
      "active_fallback": "A sua adesão está ativa."
    },
    "errors": {
      "checkout_title": "Pagamento indisponível",
      "checkout_body": "Não conseguimos iniciar o pagamento da sua adesão. Tente novamente daqui a pouco."
    },
    "toasts": {
      "subscribed_title": "Bem-vindo, Membro Apoiador!",
      "subscribed_body": "A sua adesão está a ser ativada — as vantagens aparecerão em breve.",
      "canceled_title": "Pagamento cancelado",
      "canceled_body": "Não foi feita qualquer cobrança. Pode tornar-se Membro Apoiador quando quiser."
    },
    "tip_jar_note": "Prefere deixar um donativo único? O Patreon é um mealheiro à parte.",
    "tip_jar_link": "Ver formas de apoiar →"
  },
  "ru": {
    "meta": {
      "title": "Постоянный участник — Classic Mini DIY",
      "description": "Станьте постоянным участником (1,99 $ в месяц): один аккаунт для Classic Mini DIY, The Mini Exchange и приложений Toolbox, Discord только для участников, Pro-доступ к блогу, бесплатные премиум-объявления на The Mini Exchange и поддержка канала."
    },
    "hero": {
      "eyebrow": "ПОСТОЯННЫЙ УЧАСТНИК",
      "title": "Одно участие — все ресурсы Classic Mini DIY",
      "price": "1,99 $ в месяц",
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
        "blog": {
          "title": "Pro-доступ к блогу",
          "desc": "Бесплатный доступ к материалам для подписчиков блога Classic Mini DIY."
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
      "subtitle": "1,99 $ в месяц, отмена в любой момент. Участие открывает привилегии на всех ресурсах Classic Mini DIY.",
      "checking": "Проверяем ваше участие…",
      "activating_title": "Активируем ваше участие…",
      "activating_body": "Платёж получен — включаем ваши привилегии. Обычно это занимает несколько секунд.",
      "activation_timeout_title": "Занимает больше времени, чем обычно",
      "activation_timeout_body": "Платёж прошёл, но активация занимает чуть больше времени, чем обычно. Обновите страницу через минуту; если участие всё ещё не активно, напишите нам через страницу контактов, и мы всё решим.",
      "subscribe": "Стать постоянным участником — 1,99 $ в месяц",
      "signin": "Войдите, чтобы стать участником",
      "also_apps": "Также доступно в приложениях для iOS и Android."
    },
    "member": {
      "title": "Вы постоянный участник",
      "subtitle": "Спасибо, что поддерживаете сообщество Classic Mini. Вот что открывает ваше участие.",
      "discord_title": "Discord только для участников",
      "discord_status": {
        "connected": "Подключено",
        "pending": "Приглашение отправлено",
        "revoked": "Отозвано",
        "failed": "Требует внимания",
        "not_connected": "Не подключено"
      },
      "discord_guidance": {
        "connected": "Вы в Discord для участников — до встречи там!",
        "pending": "Мы отправили ваше личное приглашение на почту — проверьте входящие (и спам), чтобы завершить вход.",
        "not_connected": "Мы отправим личное приглашение в Discord на почту, как только ваше участие станет активным. Это может занять несколько минут — следите за входящими (и спамом).",
        "revoked": "Доступ к Discord был отозван. Возобновите участие, чтобы вернуться.",
        "failed": "При выпуске приглашения в Discord возникла проблема. Напишите нам через страницу контактов, и мы всё решим."
      },
      "blog_title": "Pro-доступ к блогу",
      "blog_desc": "Бесплатный доступ к материалам для подписчиков блога Classic Mini DIY.",
      "blog_cta": "Открыть блог",
      "discord_lost_email": "Потеряли письмо с приглашением?",
      "discord_contact_cta": "Свяжитесь с нами, и мы отправим его снова.",
      "manage": "Управление участием",
      "manage_note_stripe": "Управляйте участием или отмените его в любой момент через Stripe.",
      "comp_note": "Ваше участие бесплатное — пользуйтесь всеми привилегиями за наш счёт. Управлять нечем.",
      "manage_note_store": "Управляйте подпиской или отмените её в App Store или Google Play — там, где вы её оформили.",
      "manage_note_ghost": "Управляйте участием через платёжную почту вашего аккаунта Ghost.",
      "manage_note_patreon": "Управляйте своим взносом на Patreon.",
      "active_fallback": "Ваше участие активно."
    },
    "errors": {
      "checkout_title": "Оплата недоступна",
      "checkout_body": "Не удалось начать оплату участия. Попробуйте ещё раз через минуту."
    },
    "toasts": {
      "subscribed_title": "Добро пожаловать, постоянный участник!",
      "subscribed_body": "Ваше участие активируется — привилегии появятся совсем скоро.",
      "canceled_title": "Оплата отменена",
      "canceled_body": "Списаний не было. Вы можете стать постоянным участником в любой момент."
    },
    "tip_jar_note": "Хотите вместо этого оставить разовые чаевые? Patreon — это отдельная копилка.",
    "tip_jar_link": "Посмотреть способы поддержки →"
  },
  "ja": {
    "meta": {
      "title": "サステイニングメンバー — Classic Mini DIY",
      "description": "サステイニングメンバー (月額 1.99 ドル) になると、Classic Mini DIY、The Mini Exchange、Toolbox アプリで使えるひとつのアカウント、メンバー限定 Discord、ブログの Pro アクセス、The Mini Exchange のプレミアム出品無料、そしてチャンネルの支援が可能になります。"
    },
    "hero": {
      "eyebrow": "サステイニングメンバー",
      "title": "ひとつのメンバーシップで、Classic Mini DIY のすべてを",
      "price": "月額 1.99 ドル",
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
        "blog": {
          "title": "ブログの Pro アクセス",
          "desc": "Classic Mini DIY ブログの購読者向けコンテンツを無料でご利用いただけます。"
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
      "subtitle": "月額 1.99 ドル、いつでも解約できます。メンバーシップは Classic Mini DIY のすべてのサイトで特典を解放します。",
      "checking": "メンバーシップを確認しています…",
      "activating_title": "メンバーシップを有効化しています…",
      "activating_body": "お支払いを受け取りました。特典を有効にしています。通常は数秒で完了します。",
      "activation_timeout_title": "想定より時間がかかっています",
      "activation_timeout_body": "お支払いは完了していますが、有効化にいつもより少し時間がかかっています。1 分ほどしてからこのページを再読み込みしてください。それでもメンバーシップが有効にならない場合は、お問い合わせページからご連絡ください。こちらで対応します。",
      "subscribe": "サステイニングメンバーになる — 月額 1.99 ドル",
      "signin": "サインインしてメンバーになる",
      "also_apps": "iOS・Android アプリでもご利用いただけます。"
    },
    "member": {
      "title": "あなたはサステイニングメンバーです",
      "subtitle": "Classic Mini コミュニティを支えていただきありがとうございます。メンバーシップで使える特典はこちらです。",
      "discord_title": "メンバー限定 Discord",
      "discord_status": {
        "connected": "連携済み",
        "pending": "招待を送信しました",
        "revoked": "取り消し済み",
        "failed": "確認が必要です",
        "not_connected": "未連携"
      },
      "discord_guidance": {
        "connected": "メンバー限定 Discord に参加済みです。それではまた中で!",
        "pending": "プライベートな招待をメールでお送りしました。受信トレイ (と迷惑メール) をご確認のうえ、参加を完了してください。",
        "not_connected": "メンバーシップが有効になり次第、プライベートな Discord 招待をメールでお送りします。数分かかる場合があります。受信トレイ (と迷惑メール) をご確認ください。",
        "revoked": "Discord へのアクセスが解除されました。再参加するにはメンバーシップを再開してください。",
        "failed": "Discord の招待の発行で問題が発生しました。お問い合わせページからご連絡ください。こちらで対応します。"
      },
      "blog_title": "ブログの Pro アクセス",
      "blog_desc": "Classic Mini DIY ブログの購読者向けコンテンツを無料でご利用いただけます。",
      "blog_cta": "ブログを開く",
      "discord_lost_email": "招待メールが見つかりませんか?",
      "discord_contact_cta": "お問い合わせいただければ再送します。",
      "manage": "メンバーシップの管理",
      "manage_note_stripe": "Stripe からいつでもメンバーシップの管理・解約ができます。",
      "comp_note": "あなたのメンバーシップは無償提供です。すべての特典をどうぞご利用ください。管理する項目はありません。",
      "manage_note_store": "登録した場所に応じて、App Store または Google Play でサブスクリプションの管理・解約ができます。",
      "manage_note_ghost": "Ghost アカウントの請求先メールアドレスからメンバーシップを管理できます。",
      "manage_note_patreon": "Patreon で支援内容を管理できます。",
      "active_fallback": "メンバーシップは有効です。"
    },
    "errors": {
      "checkout_title": "お支払い手続きを利用できません",
      "checkout_body": "メンバーシップのお支払い手続きを開始できませんでした。しばらくしてからもう一度お試しください。"
    },
    "toasts": {
      "subscribed_title": "ようこそ、サステイニングメンバー!",
      "subscribed_body": "メンバーシップを有効化しています。まもなく特典が表示されます。",
      "canceled_title": "お支払いをキャンセルしました",
      "canceled_body": "請求は発生していません。準備ができたらいつでもサステイニングメンバーになれます。"
    },
    "tip_jar_note": "代わりに一回きりの支援をお考えですか? Patreon は別のチップ用の窓口です。",
    "tip_jar_link": "支援の方法を見る →"
  },
  "zh": {
    "meta": {
      "title": "持续支持会员 — Classic Mini DIY",
      "description": "成为持续支持会员(每月 1.99 美元):在 Classic Mini DIY、The Mini Exchange 和 Toolbox 应用中共用一个账号,加入会员专属 Discord,获得博客 Pro 访问权限、The Mini Exchange 免费高级刊登,并支持本频道。"
    },
    "hero": {
      "eyebrow": "持续支持会员",
      "title": "一份会员资格,通行所有 Classic Mini DIY 站点",
      "price": "每月 1.99 美元",
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
        "blog": {
          "title": "博客 Pro 访问权限",
          "desc": "免费阅读 Classic Mini DIY 博客的订阅者内容。"
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
      "subtitle": "每月 1.99 美元,随时可取消。会员资格将解锁所有 Classic Mini DIY 站点的权益。",
      "checking": "正在检查你的会员资格…",
      "activating_title": "正在激活你的会员资格…",
      "activating_body": "已收到付款——我们正在为你开启权益,通常只需几秒钟。",
      "activation_timeout_title": "耗时比预期长",
      "activation_timeout_body": "你的付款已成功,但激活比平时稍慢一些。请过一分钟后刷新本页;如果会员资格仍未生效,请通过联系页面告诉我们,我们会帮你处理。",
      "subscribe": "成为持续支持会员 — 每月 1.99 美元",
      "signin": "登录以成为会员",
      "also_apps": "iOS 和 Android 应用中同样可用。"
    },
    "member": {
      "title": "你是持续支持会员",
      "subtitle": "感谢你让 Classic Mini 社群持续运转。以下是你的会员资格所解锁的内容。",
      "discord_title": "会员专属 Discord",
      "discord_status": {
        "connected": "已连接",
        "pending": "邀请已发送",
        "revoked": "已撤销",
        "failed": "需要处理",
        "not_connected": "未连接"
      },
      "discord_guidance": {
        "connected": "你已在会员专属 Discord 中——里面见!",
        "pending": "你的专属邀请已通过邮件发出——请查收收件箱(以及垃圾邮件)以完成加入。",
        "not_connected": "会员资格生效后,我们会通过邮件发送你的专属 Discord 邀请。可能需要几分钟——请留意收件箱(以及垃圾邮件)。",
        "revoked": "你的 Discord 访问权限已被移除。重新启用会员资格即可再次加入。",
        "failed": "发放你的 Discord 邀请时出了点问题。请通过联系页面告诉我们,我们会帮你处理。"
      },
      "blog_title": "博客 Pro 访问权限",
      "blog_desc": "免费阅读 Classic Mini DIY 博客的订阅者内容。",
      "blog_cta": "打开博客",
      "discord_lost_email": "找不到邀请邮件?",
      "discord_contact_cta": "联系我们,我们会重新发送。",
      "manage": "管理会员资格",
      "manage_note_stripe": "你可以随时通过 Stripe 管理或取消会员资格。",
      "comp_note": "你的会员资格由我们赠送——尽情享用全部权益,无需任何操作。",
      "manage_note_store": "请在你订阅所在的 App Store 或 Google Play 中管理或取消订阅。",
      "manage_note_ghost": "通过你的 Ghost 账号账单邮箱管理会员资格。",
      "manage_note_patreon": "在 Patreon 上管理你的支持。",
      "active_fallback": "你的会员资格已生效。"
    },
    "errors": {
      "checkout_title": "暂时无法结账",
      "checkout_body": "我们无法开始你的会员结账流程。请稍后再试。"
    },
    "toasts": {
      "subscribed_title": "欢迎你,持续支持会员!",
      "subscribed_body": "你的会员资格正在激活——权益稍后就会出现。",
      "canceled_title": "结账已取消",
      "canceled_body": "未产生任何扣款。你随时都可以成为持续支持会员。"
    },
    "tip_jar_note": "想改为一次性打赏? Patreon 是一个独立的打赏渠道。",
    "tip_jar_link": "查看支持方式 →"
  },
  "ko": {
    "meta": {
      "title": "서포팅 멤버 — Classic Mini DIY",
      "description": "서포팅 멤버(월 1.99달러)가 되시면 Classic Mini DIY, The Mini Exchange, Toolbox 앱에서 쓰는 하나의 계정, 멤버 전용 Discord, 블로그 Pro 이용, The Mini Exchange 프리미엄 매물 무료 등록, 그리고 채널 후원까지 함께하실 수 있습니다."
    },
    "hero": {
      "eyebrow": "서포팅 멤버",
      "title": "멤버십 하나로 Classic Mini DIY 전체를",
      "price": "월 1.99달러",
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
        "blog": {
          "title": "블로그 Pro 이용",
          "desc": "Classic Mini DIY 블로그의 구독자 전용 콘텐츠를 무료로 이용하실 수 있습니다."
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
      "subtitle": "월 1.99달러, 언제든 해지 가능합니다. 멤버십은 모든 Classic Mini DIY 사이트의 혜택을 열어 줍니다.",
      "checking": "멤버십을 확인하는 중…",
      "activating_title": "멤버십을 활성화하는 중…",
      "activating_body": "결제가 확인되었습니다. 혜택을 켜는 중이며, 보통 몇 초면 끝납니다.",
      "activation_timeout_title": "예상보다 오래 걸리고 있습니다",
      "activation_timeout_body": "결제는 정상 처리되었지만 활성화가 평소보다 조금 오래 걸리고 있습니다. 1분 뒤 이 페이지를 새로고침해 주세요. 그래도 멤버십이 활성화되지 않으면 문의 페이지로 연락 주시면 처리해 드리겠습니다.",
      "subscribe": "서포팅 멤버 되기 — 월 1.99달러",
      "signin": "로그인하고 멤버 되기",
      "also_apps": "iOS·Android 앱에서도 이용하실 수 있습니다."
    },
    "member": {
      "title": "서포팅 멤버이십니다",
      "subtitle": "Classic Mini 커뮤니티를 지켜 주셔서 감사합니다. 멤버십으로 이용하실 수 있는 혜택입니다.",
      "discord_title": "멤버 전용 Discord",
      "discord_status": {
        "connected": "연결됨",
        "pending": "초대 발송됨",
        "revoked": "해제됨",
        "failed": "확인 필요",
        "not_connected": "연결 안 됨"
      },
      "discord_guidance": {
        "connected": "멤버 전용 Discord에 참여 중이십니다. 안에서 뵙겠습니다!",
        "pending": "비공개 초대를 이메일로 보내 드렸습니다. 받은편지함(및 스팸함)을 확인하고 참여를 마무리해 주세요.",
        "not_connected": "멤버십이 활성화되면 비공개 Discord 초대를 이메일로 보내 드립니다. 몇 분 정도 걸릴 수 있으니 받은편지함(및 스팸함)을 확인해 주세요.",
        "revoked": "Discord 접근 권한이 해제되었습니다. 다시 참여하시려면 멤버십을 재개해 주세요.",
        "failed": "Discord 초대를 발급하는 중 문제가 있었습니다. 문의 페이지로 연락 주시면 처리해 드리겠습니다."
      },
      "blog_title": "블로그 Pro 이용",
      "blog_desc": "Classic Mini DIY 블로그의 구독자 전용 콘텐츠를 무료로 이용하실 수 있습니다.",
      "blog_cta": "블로그 열기",
      "discord_lost_email": "초대 이메일을 못 찾으셨나요?",
      "discord_contact_cta": "문의해 주시면 다시 보내 드리겠습니다.",
      "manage": "멤버십 관리",
      "manage_note_stripe": "Stripe에서 언제든 멤버십을 관리하거나 해지하실 수 있습니다.",
      "comp_note": "회원님의 멤버십은 무료로 제공됩니다. 모든 혜택을 마음껏 누리세요. 따로 관리하실 것은 없습니다.",
      "manage_note_store": "구독하신 곳에 따라 App Store 또는 Google Play에서 구독을 관리하거나 해지하실 수 있습니다.",
      "manage_note_ghost": "Ghost 계정의 청구 이메일을 통해 멤버십을 관리하실 수 있습니다.",
      "manage_note_patreon": "Patreon에서 후원을 관리하실 수 있습니다.",
      "active_fallback": "멤버십이 활성화되어 있습니다."
    },
    "errors": {
      "checkout_title": "결제를 이용할 수 없습니다",
      "checkout_body": "멤버십 결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."
    },
    "toasts": {
      "subscribed_title": "환영합니다, 서포팅 멤버님!",
      "subscribed_body": "멤버십을 활성화하는 중입니다. 곧 혜택이 표시됩니다.",
      "canceled_title": "결제가 취소되었습니다",
      "canceled_body": "청구된 금액은 없습니다. 준비되시면 언제든 서포팅 멤버가 되실 수 있습니다."
    },
    "tip_jar_note": "대신 일회성 후원을 원하시나요? Patreon은 별도의 후원 창구입니다.",
    "tip_jar_link": "후원 방법 보기 →"
  }
}
</i18n>
