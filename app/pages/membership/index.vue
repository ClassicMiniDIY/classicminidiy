<script lang="ts" setup>
  const { t } = useI18n();
  const route = useRoute();
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { capture } = usePostHog();
  const { add: addToast } = useToast();
  const { isAuthenticated, isSustainingMember, user, waitForAuth } = useAuth();

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
  const portalLoading = ref(false);

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
      navigateTo('/login');
      return;
    }
    checkoutLoading.value = true;
    capture('membership_checkout_started', { source: 'web' });
    try {
      const token = await getAccessToken();
      if (!token) {
        navigateTo('/login');
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

  // Existing web members self-manage through the Stripe Billing Portal.
  async function manageMembership() {
    portalLoading.value = true;
    capture('membership_portal_opened', { source: 'web' });
    try {
      const token = await getAccessToken();
      if (!token) {
        navigateTo('/login');
        return;
      }
      const res = await $fetch<{ url?: string }>('/api/membership/portal', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res?.url) throw new Error('Missing portal URL');
      await navigateTo(res.url, { external: true });
    } catch (error) {
      console.error('Billing portal failed:', error);
      addToast({
        title: t('errors.portal_title'),
        description: t('errors.portal_body'),
        color: 'error',
        icon: 'i-fa6-solid-triangle-exclamation',
      });
    } finally {
      portalLoading.value = false;
    }
  }

  onMounted(async () => {
    await waitForAuth();
    authReady.value = true;

    // Stripe returns to /membership?subscribed=1 or ?canceled=1.
    if (route.query.subscribed) {
      capture('membership_checkout_succeeded', { source: 'web' });
      addToast({
        title: t('toasts.subscribed_title'),
        description: t('toasts.subscribed_body'),
        color: 'success',
        icon: 'i-fa6-solid-circle-check',
        timeout: 8000,
      });
      // The subscriptions row is written asynchronously by the webhook; re-pull
      // profile + membership so the badge/management area reflects it soon.
      if (user.value) {
        const { fetchUserProfile } = useAuth();
        fetchUserProfile(user.value.id);
      }
    } else if (route.query.canceled) {
      addToast({
        title: t('toasts.canceled_title'),
        description: t('toasts.canceled_body'),
        color: 'info',
        icon: 'i-fa6-solid-circle-info',
      });
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
          <div class="badge badge-warning badge-lg font-semibold gap-1 mb-4">
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
          <li
            v-for="benefit in benefits"
            :key="benefit.key"
            class="card bg-base-100 border border-base-300 shadow-sm"
          >
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
        <!-- Active member: management + your-benefits area -->
        <section v-if="authReady && isSustainingMember" class="card bg-base-100 border border-primary/40 shadow-md">
          <div class="card-body">
            <div class="flex flex-wrap items-center gap-3">
              <ProfileSustainingBadge size="md" />
              <h2 class="text-2xl font-bold">{{ t('member.title') }}</h2>
            </div>
            <p class="opacity-70">{{ t('member.subtitle') }}</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <!-- Discord entry point (static; live connect-status pending the
                   discord_links SELECT-own RLS policy, keystone §6.2) -->
              <div class="rounded-box border border-base-300 p-4">
                <p class="font-semibold"><i class="fab fa-discord mr-2 text-primary"></i>{{ t('member.discord_title') }}</p>
                <p class="text-sm opacity-70 mt-1">{{ t('member.discord_desc') }}</p>
              </div>
              <!-- Pro blog access -->
              <div class="rounded-box border border-base-300 p-4">
                <p class="font-semibold"><i class="fas fa-book-open mr-2 text-primary"></i>{{ t('member.blog_title') }}</p>
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

            <div class="card-actions mt-4">
              <button class="btn btn-outline btn-primary" :disabled="portalLoading" @click="manageMembership">
                <i v-if="portalLoading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-gear"></i>
                {{ t('member.manage') }}
              </button>
            </div>
            <p class="text-xs opacity-60 mt-2">{{ t('member.manage_note') }}</p>
          </div>
        </section>

        <!-- Non-member / logged-out: subscribe CTA -->
        <section v-else class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body items-center text-center">
            <h2 class="text-2xl font-bold">{{ t('cta.title') }}</h2>
            <p class="opacity-70 max-w-lg">{{ t('cta.subtitle') }}</p>

            <div class="mt-4">
              <button
                v-if="authReady && isAuthenticated"
                class="btn btn-primary btn-lg"
                :disabled="checkoutLoading"
                @click="subscribe"
              >
                <i v-if="checkoutLoading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-star"></i>
                {{ t('cta.subscribe') }}
              </button>
              <NuxtLink v-else to="/login" class="btn btn-primary btn-lg">
                <i class="fas fa-right-to-bracket"></i>
                {{ t('cta.signin') }}
              </NuxtLink>
            </div>

            <p class="text-sm opacity-60 mt-3">
              <i class="fas fa-mobile-screen mr-1"></i>{{ t('cta.also_apps') }}
            </p>
          </div>
        </section>

        <template #fallback>
          <section class="card bg-base-100 border border-base-300 shadow-md">
            <div class="card-body items-center text-center">
              <h2 class="text-2xl font-bold">{{ t('cta.title') }}</h2>
              <p class="opacity-70 max-w-lg">{{ t('cta.subtitle') }}</p>
              <NuxtLink to="/login" class="btn btn-primary btn-lg mt-4">
                <i class="fas fa-star"></i>
                {{ t('cta.signin') }}
              </NuxtLink>
              <p class="text-sm opacity-60 mt-3">
                <i class="fas fa-mobile-screen mr-1"></i>{{ t('cta.also_apps') }}
              </p>
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
      "subscribe": "Become a Sustaining Member — $1.99/mo",
      "signin": "Sign in to become a member",
      "also_apps": "Also available in the iOS and Android apps."
    },
    "member": {
      "title": "You're a Sustaining Member",
      "subtitle": "Thanks for keeping the Classic Mini community running. Here's what your membership unlocks.",
      "discord_title": "Members-only Discord",
      "discord_desc": "Watch for your private invite by email, or request one from the Classic Mini DIY app.",
      "blog_title": "Pro access to the blog",
      "blog_desc": "Complimentary access to subscriber content on the Classic Mini DIY blog.",
      "blog_cta": "Open the blog",
      "manage": "Manage membership",
      "manage_note": "Manage or cancel your membership through Stripe. Members who subscribed in the iOS or Android apps manage through the App Store or Google Play."
    },
    "errors": {
      "checkout_title": "Checkout unavailable",
      "checkout_body": "We couldn't start your membership checkout. Please try again in a moment.",
      "portal_title": "Billing portal unavailable",
      "portal_body": "We couldn't open the billing portal. Please try again in a moment."
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
