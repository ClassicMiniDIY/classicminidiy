<script lang="ts" setup>
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { add: addToast } = useToast();
  const { isAuthenticated, user, waitForAuth, fetchUserProfile } = useAuth();

  // The emailed claim link (Ghost/Patreon inbound channels) lands here as
  // /membership/claim?code=<claim_jti>. Redemption = claim_external_membership(p_code)
  // while signed in: it writes the subscriptions row (fan-out: badge, Discord,
  // Ghost comp, TME listings) and marks the pending row claimed. The RPC is
  // idempotent for the same user re-clicking the same emailed link.
  const code = computed(() => {
    const raw = route.query.code;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  });

  // Logged-out claim intent: same /login?redirect= round trip the membership
  // page uses (login re-validates via sanitizeRedirectPath and stashes the path
  // in localStorage; /auth/callback consumes it after the OAuth/magic-link
  // round trip). Re-encode the code so the query survives both decode passes.
  const claimIntentPath = computed(() =>
    code.value ? `/membership/claim?code=${encodeURIComponent(code.value)}` : '/membership/claim'
  );
  const loginWithIntentHref = computed(() => `/login?redirect=${encodeURIComponent(claimIntentPath.value)}`);

  type ClaimState =
    | 'checking' // resolving auth / about to redeem
    | 'missing_code' // no ?code= in the URL
    | 'signin' // logged out — needs the login round trip first
    | 'redeeming' // RPC in flight
    | 'success' // membership attached
    | 'invalid' // unknown / malformed code (P0002 generic, 22004)
    | 'already_claimed' // code consumed by a different account
    | 'expired' // stale link (>30 days) — reconciliation cron re-issues
    | 'error'; // transient RPC/network failure — retryable
  const state = ref<ClaimState>('checking');

  // Let the user actually see the success card before landing on /membership.
  const SUCCESS_REDIRECT_DELAY_MS = 1500;

  // Map RPC failures onto distinct friendly states. All three business errors
  // raise ERRCODE P0002 with distinct messages (see migration
  // 20260609000001_inbound_membership_channels.sql), so the message is the
  // discriminator; anything else is treated as transient and retryable.
  function handleClaimError(error: { code?: string; message?: string } | null) {
    const message = error?.message ?? '';
    let reason: string;
    if (message.includes('already been claimed')) {
      state.value = 'already_claimed';
      reason = 'already_claimed';
    } else if (message.includes('expired') && message.includes('emailed')) {
      state.value = 'expired';
      reason = 'expired';
    } else if (error?.code === 'P0002' || error?.code === '22004') {
      state.value = 'invalid';
      reason = 'invalid';
    } else {
      state.value = 'error';
      reason = 'rpc_error';
    }
    track('membership_claim_failed', { source: 'web', reason, error_code: error?.code });
  }

  async function redeem() {
    if (!code.value) return;
    state.value = 'redeeming';
    try {
      // Cast the RPC name until types/database.ts is regenerated post-deploy
      // (same precedent as get_my_membership on /membership).
      const { data, error } = await supabase.rpc('claim_external_membership' as any, { p_code: code.value });
      if (error) {
        console.error('Membership claim failed:', error);
        handleClaimError(error);
        return;
      }
      // RETURNS TABLE → PostgREST hands back an array of rows.
      const row = (Array.isArray(data) ? data[0] : data) as { platform?: string | null } | undefined;
      track('membership_claim_redeemed', { source: 'web', platform: row?.platform ?? undefined });
      state.value = 'success';
      addToast({
        title: t('toasts.success_title'),
        description: t('toasts.success_body'),
        color: 'success',
        icon: 'i-fa6-solid-circle-check',
        timeout: 8000,
      });
      // The RPC writes the subscriptions row synchronously — refresh the shared
      // membership gate so /membership renders the member area on arrival.
      if (user.value) await fetchUserProfile(user.value.id);
      setTimeout(() => navigateTo('/membership'), SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      console.error('Membership claim failed:', err);
      track('membership_claim_failed', { source: 'web', reason: 'exception' });
      state.value = 'error';
    }
  }

  async function begin() {
    state.value = 'checking';
    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }
    await redeem();
  }

  // Run exactly once, as soon as a code is available. The code can arrive
  // late: when the PWA service worker serves the precached '/' shell (or a
  // statically-served copy boots the app), the router can briefly disagree
  // with the address bar — the same failure mode the /auth/callback
  // routeRules entry documents. So: route.query first, location.search as
  // the fallback, and a watcher to catch the router syncing up after mount.
  let begun = false;
  function tryBegin(): boolean {
    if (begun || !code.value) return begun;
    begun = true;
    void begin();
    return true;
  }
  watch(code, () => {
    tryBegin();
  });
  onMounted(() => {
    if (tryBegin()) return;
    const locCode = (new URLSearchParams(window.location.search).get('code') ?? '').trim();
    if (locCode) {
      // The address bar has the code but the router lost it — re-sync the
      // route (keeps `code`/`claimIntentPath` consistent); the watcher begins.
      void router.replace({ query: { ...route.query, code: locCode } });
      return;
    }
    state.value = 'missing_code';
    track('membership_claim_failed', { source: 'web', reason: 'missing_code' });
  });

  // Transient page reached from a single-use emailed link — never index it.
  useHead({
    title: t('meta.title'),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
    <div class="card bg-base-100 shadow-md border border-base-300 w-full max-w-md">
      <ClientOnly>
        <div class="card-body items-center text-center">
          <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>

          <!-- Resolving auth -->
          <template v-if="state === 'checking'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </template>

          <!-- RPC in flight -->
          <template v-else-if="state === 'redeeming'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <h1 class="text-2xl font-bold mt-3">{{ t('redeeming.title') }}</h1>
            <p class="opacity-70">{{ t('redeeming.body') }}</p>
          </template>

          <!-- Membership attached -->
          <template v-else-if="state === 'success'">
            <i class="fas fa-circle-check text-4xl text-success mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('success.title') }}</h1>
            <p class="opacity-70">{{ t('success.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('success.cta') }}
            </NuxtLink>
          </template>

          <!-- Logged out: claim intent rides the existing /login?redirect= flow -->
          <template v-else-if="state === 'signin'">
            <i class="fas fa-right-to-bracket text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('signin.title') }}</h1>
            <p class="opacity-70">{{ t('signin.body') }}</p>
            <NuxtLink :to="loginWithIntentHref" class="btn btn-primary mt-4">
              <i class="fas fa-right-to-bracket"></i>
              {{ t('signin.cta') }}
            </NuxtLink>
          </template>

          <!-- No ?code= in the URL -->
          <template v-else-if="state === 'missing_code'">
            <i class="fas fa-circle-exclamation text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('missing_code.title') }}</h1>
            <p class="opacity-70">{{ t('missing_code.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('membership_link') }}
            </NuxtLink>
          </template>

          <!-- Code consumed by a different account -->
          <template v-else-if="state === 'already_claimed'">
            <i class="fas fa-user-lock text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('already_claimed.title') }}</h1>
            <p class="opacity-70">{{ t('already_claimed.body') }}</p>
          </template>

          <!-- Stale link (>30 days) — a fresh one is re-issued automatically -->
          <template v-else-if="state === 'expired'">
            <i class="fas fa-hourglass-half text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('expired.title') }}</h1>
            <p class="opacity-70">{{ t('expired.body') }}</p>
          </template>

          <!-- Unknown / malformed code -->
          <template v-else-if="state === 'invalid'">
            <i class="fas fa-circle-xmark text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('invalid.title') }}</h1>
            <p class="opacity-70">{{ t('invalid.body') }}</p>
          </template>

          <!-- Transient RPC/network failure -->
          <template v-else>
            <i class="fas fa-triangle-exclamation text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('error.title') }}</h1>
            <p class="opacity-70">{{ t('error.body') }}</p>
            <button type="button" class="btn btn-primary mt-4" @click="redeem">
              <i class="fas fa-rotate-right"></i>
              {{ t('error.retry') }}
            </button>
          </template>

          <!-- Contact fallback on every dead-end error state -->
          <p
            v-if="state === 'invalid' || state === 'already_claimed' || state === 'expired' || state === 'error'"
            class="text-sm opacity-70 mt-4"
          >
            {{ t('contact_question') }}
            <NuxtLink to="/contact" class="link link-primary">{{ t('contact_cta') }}</NuxtLink>
          </p>
        </div>

        <template #fallback>
          <!-- SSR / pre-hydration: matches the 'checking' state so there is no
               flash between server render and the resolved client state. -->
          <div class="card-body items-center text-center">
            <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Claim your membership — Classic Mini DIY"
    },
    "eyebrow": "SUSTAINING MEMBER",
    "checking": "Checking your claim link…",
    "redeeming": {
      "title": "Activating your membership…",
      "body": "Hang tight — we're attaching your Sustaining Membership to this account."
    },
    "signin": {
      "title": "Sign in to claim your membership",
      "body": "You're almost there — sign in (or create a free account) and we'll attach your Sustaining Membership to it. You'll come right back here afterwards.",
      "cta": "Sign in to claim"
    },
    "success": {
      "title": "Your membership is active!",
      "body": "Welcome, Sustaining Member — your benefits are switched on across every Classic Mini DIY property.",
      "cta": "See your benefits"
    },
    "missing_code": {
      "title": "That link is missing its claim code",
      "body": "This page only works from the claim link in your membership email. Open the email and click the button again — or learn more about Sustaining Membership below."
    },
    "already_claimed": {
      "title": "This membership was already claimed",
      "body": "This claim link has already been used on a different account. If that doesn't sound right — maybe you signed in with another email — we can move it for you."
    },
    "expired": {
      "title": "This claim link has expired",
      "body": "Claim links are valid for 30 days. No need to do anything — a fresh link is on its way to your inbox automatically."
    },
    "invalid": {
      "title": "We couldn't find that claim code",
      "body": "This claim link doesn't match a pending membership. Double-check you opened the most recent email — older links stop working once a newer one is issued."
    },
    "error": {
      "title": "Something went wrong",
      "body": "We couldn't reach the membership service just now. Your claim link is still valid — give it another try.",
      "retry": "Try again"
    },
    "contact_question": "Something not right?",
    "contact_cta": "Contact us and we'll sort it out.",
    "membership_link": "About Sustaining Membership",
    "toasts": {
      "success_title": "Your membership is active!",
      "success_body": "Thanks for supporting Classic Mini DIY — your benefits are live everywhere you sign in."
    }
  }
}
</i18n>
