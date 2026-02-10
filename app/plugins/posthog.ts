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

    router.afterEach((to) => {
      nextTick(() => {
        posthog.capture('$pageview', {
          current_url: to.fullPath,
        });
      });
    });

    return {
      provide: {
        posthog,
      },
    };
  },
});
