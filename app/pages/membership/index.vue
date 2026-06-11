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
  // Poll the membership gate every ~2s for up to ~30s, showing "Activating…"
  // instead of the CTA; on timeout show a gentle refresh note. (The server-side
  // double-billing guard is the backend half — punch list B1.)
  const ACTIVATION_POLL_INTERVAL_MS = 2000;
  const ACTIVATION_POLL_MAX_ATTEMPTS = 15; // ~30s total
  const activationState = ref<'idle' | 'polling' | 'timeout'>('idle');
  let activationStopped = false;
  onUnmounted(() => {
    activationStopped = true;
  });

  async function pollMembershipActivation() {
    if (!user.value || isSustainingMember.value) return;
    activationState.value = 'polling';
    for (let attempt = 0; attempt < ACTIVATION_POLL_MAX_ATTEMPTS; attempt++) {
      // Signed out (or session expired) mid-poll: there's nothing to activate
      // for this browser anymore — stop quietly instead of crashing on a null
      // user.
      if (!user.value) {
        activationState.value = 'idle';
        return;
      }
      await fetchUserProfile(user.value.id);
      if (activationStopped) return;
      if (isSustainingMember.value) {
        activationState.value = 'idle';
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, ACTIVATION_POLL_INTERVAL_MS));
      if (activationStopped) return;
    }
    activationState.value = 'timeout';
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
        icon: 'i-fa6-solid-triangle-exclamation',
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
          icon: 'i-fa6-solid-circle-check',
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
          icon: 'i-fa6-solid-circle-info',
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
  }
}
</i18n>
