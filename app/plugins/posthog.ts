import posthog from 'posthog-js';

export default defineNuxtPlugin({
  name: 'posthog',
  parallel: true,
  setup(nuxtApp) {
    const config = useRuntimeConfig();
    const router = useRouter();

    const posthogKey = config.public.posthogPublicKey as string;
    const posthogHost = config.public.posthogHost as string;
    const posthogUiHost = config.public.posthogUiHost as string;

    if (!posthogKey) return;

    posthog.init(posthogKey, {
      api_host: posthogHost,
      ui_host: posthogUiHost,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      loaded: (posthog) => {
        if (import.meta.env.MODE === 'development') posthog.debug();
      },
    });

    // Manual SPA pageviews. router.afterEach does not fire for the initial
    // (hydrated) navigation, so capture the entry route explicitly. The
    // last-path guard prevents double-counting if afterEach also fires for it.
    let lastTrackedPath = '';
    const trackPageview = (fullPath: string) => {
      if (fullPath === lastTrackedPath) return;
      lastTrackedPath = fullPath;
      posthog.capture('$pageview', { current_url: fullPath });
    };

    nextTick(() => trackPageview(router.currentRoute.value.fullPath));
    router.afterEach((to) => {
      nextTick(() => trackPageview(to.fullPath));
    });

    return {
      provide: {
        posthog,
      },
    };
  },
});
