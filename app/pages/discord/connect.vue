<script lang="ts" setup>
  const { t } = useI18n();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { isAuthenticated, waitForAuth } = useAuth();

  // Self-serve Discord claim for signed-in Sustaining Members (keystone §5.3).
  // The mobile apps' "Claim Discord Access" buttons (and any bookmark) open
  // /discord/claim with no token; the server proxy routes those bare hits here.
  // We mint a fresh claim token via /api/discord/reissue (discord-claim-reissue
  // Edge Function — paid members only), then re-enter the normal tokened chain:
  // /discord/claim?token= → discord-claim → Discord OAuth → role granted.
  //
  // App users arrive in the system browser with NO web session even though
  // they're signed in to the app, so the signin card is the common first stop —
  // the copy points them at using the same account as the app.

  type ConnectState =
    | 'checking' // resolving auth
    | 'signin' // logged out — needs the login round trip first
    | 'connecting' // reissue in flight / redirecting into Discord OAuth
    | 'active' // already linked — nothing to claim
    | 'not_member' // signed in but no active Sustaining Membership
    | 'error'; // transient proxy/network failure — retryable
  const state = ref<ConnectState>('checking');
  const discordUrl = ref<string | null>(null);

  const loginWithIntentHref = `/login?redirect=${encodeURIComponent('/discord/connect')}`;

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function connect() {
    state.value = 'connecting';
    try {
      const token = await getAccessToken();
      if (!token) {
        // Session evaporated between the auth check and the claim — send them
        // back through sign-in with the connect intent preserved.
        await navigateTo(loginWithIntentHref);
        return;
      }
      const res = await $fetch<{ status?: string; claim_url?: string; discord_url?: string }>(
        '/api/discord/reissue',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        }
      );
      if (res?.status === 'active') {
        discordUrl.value = res.discord_url ?? null;
        state.value = 'active';
        track('discord_claim_reissued', { source: 'web', result: 'already_active' });
        return;
      }
      if (res?.status === 'pending' && res.claim_url) {
        track('discord_claim_reissued', { source: 'web', result: 'pending' });
        // Full document navigation into the OAuth chain — same external
        // redirect convention as the Stripe checkout hand-off.
        await navigateTo(res.claim_url, { external: true });
        return;
      }
      throw new Error('Unexpected reissue response shape');
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      if (status === 403) {
        state.value = 'not_member';
        track('discord_claim_reissue_failed', { source: 'web', reason: 'not_member' });
        return;
      }
      if (status === 401) {
        // The local session looked valid but the server rejected the token
        // (deleted user, auth incident). Clear it first — otherwise /login
        // sees isAuthenticated, bounces straight back here, and we loop.
        await supabase.auth.signOut().catch(() => {});
        await navigateTo(loginWithIntentHref);
        return;
      }
      console.error('Discord claim reissue failed:', err);
      state.value = 'error';
      track('discord_claim_reissue_failed', { source: 'web', reason: 'exception' });
    }
  }

  onMounted(async () => {
    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }
    await connect();
  });

  // Transient claim-chain page — never index it.
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

          <!-- Reissue in flight / redirecting to Discord -->
          <template v-else-if="state === 'connecting'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <h1 class="text-2xl font-bold mt-3">{{ t('connecting.title') }}</h1>
            <p class="opacity-70">{{ t('connecting.body') }}</p>
          </template>

          <!-- Logged out: connect intent rides the existing /login?redirect= flow.
               App users land here without a web session — same account as the app. -->
          <template v-else-if="state === 'signin'">
            <i class="fas fa-right-to-bracket text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('signin.title') }}</h1>
            <p class="opacity-70">{{ t('signin.body') }}</p>
            <NuxtLink :to="loginWithIntentHref" class="btn btn-primary mt-4">
              <i class="fas fa-right-to-bracket"></i>
              {{ t('signin.cta') }}
            </NuxtLink>
          </template>

          <!-- Already linked -->
          <template v-else-if="state === 'active'">
            <i class="fas fa-circle-check text-4xl text-success mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('active.title') }}</h1>
            <p class="opacity-70">{{ t('active.body') }}</p>
            <a v-if="discordUrl" :href="discordUrl" class="btn btn-primary mt-4">
              <i class="fab fa-discord"></i>
              {{ t('active.cta') }}
            </a>
          </template>

          <!-- Signed in but not a paid Sustaining Member -->
          <template v-else-if="state === 'not_member'">
            <i class="fas fa-star text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('not_member.title') }}</h1>
            <p class="opacity-70">{{ t('not_member.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('not_member.cta') }}
            </NuxtLink>
          </template>

          <!-- Transient failure -->
          <template v-else>
            <i class="fas fa-triangle-exclamation text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('error.title') }}</h1>
            <p class="opacity-70">{{ t('error.body') }}</p>
            <button type="button" class="btn btn-primary mt-4" @click="connect">
              <i class="fas fa-rotate-right"></i>
              {{ t('error.retry') }}
            </button>
          </template>

          <!-- Contact fallback on dead-end states -->
          <p v-if="state === 'not_member' || state === 'error'" class="text-sm opacity-70 mt-4">
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
      "title": "Connect your Discord — Classic Mini DIY"
    },
    "eyebrow": "Members-only Discord",
    "checking": "Checking your membership…",
    "connecting": {
      "title": "Connecting your Discord",
      "body": "Hang tight — we're sending you to Discord to authorize your members-only access."
    },
    "signin": {
      "title": "Sign in to claim your access",
      "body": "Sign in with the same Classic Mini DIY account you use in the Toolbox app, and we'll connect your Discord right after.",
      "cta": "Sign in"
    },
    "active": {
      "title": "You're already connected",
      "body": "Your Discord is linked and your members-only role is active. See you in there!",
      "cta": "Open Discord"
    },
    "not_member": {
      "title": "Membership required",
      "body": "The members-only Discord is a Sustaining Member benefit. Check your membership status or become a member to join.",
      "cta": "View membership"
    },
    "error": {
      "title": "Something went wrong",
      "body": "We couldn't start your Discord claim. Give it another try in a moment.",
      "retry": "Try again"
    },
    "contact_question": "Still stuck?",
    "contact_cta": "Contact us"
  }
}
</i18n>
