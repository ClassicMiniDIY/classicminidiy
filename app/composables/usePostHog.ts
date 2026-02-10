import type posthog from 'posthog-js';

export function usePostHog() {
  const nuxtApp = useNuxtApp();

  const ph = nuxtApp.$posthog as typeof posthog | undefined;

  function capture(event: string, properties?: Record<string, unknown>) {
    ph?.capture(event, properties);
  }

  function identify(distinctId: string, properties?: Record<string, unknown>) {
    ph?.identify(distinctId, properties);
  }

  function reset() {
    ph?.reset();
  }

  return { capture, identify, reset };
}
