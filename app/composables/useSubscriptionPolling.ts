/**
 * Post-checkout activation polling, shared by /membership and /developers.
 *
 * Stripe returns the buyer with ?subscribed=1 before the webhook has
 * necessarily written the `subscriptions` row, so a single re-check can still
 * show the subscribe CTA to someone who just paid. This polls the caller's
 * entitlement check every ~2s for up to ~30s, exposing 'polling' (render
 * "Activating…" instead of the CTA) and 'timeout' (render a gentle refresh
 * note). Extracted from /membership's pollMembershipActivation (punch list D1)
 * when /developers needed the identical flow.
 *
 * The check returns:
 *   'active'  — entitlement observed; stop, state back to 'idle'.
 *   'pending' — not yet; keep polling.
 *   'abort'   — nothing to poll for anymore (signed out mid-poll); stop quietly.
 */

export type ActivationCheck = () => Promise<'active' | 'pending' | 'abort'>;

export interface ActivationPollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

export function useSubscriptionPolling(check: ActivationCheck, options: ActivationPollingOptions = {}) {
  const intervalMs = options.intervalMs ?? 2000;
  const maxAttempts = options.maxAttempts ?? 15; // ~30s total

  const activationState = ref<'idle' | 'polling' | 'timeout'>('idle');
  let stopped = false;
  onUnmounted(() => {
    stopped = true;
  });

  async function pollActivation(): Promise<void> {
    activationState.value = 'polling';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await check();
      if (stopped) return;
      if (result === 'abort') {
        activationState.value = 'idle';
        return;
      }
      if (result === 'active') {
        activationState.value = 'idle';
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (stopped) return;
    }
    activationState.value = 'timeout';
  }

  return { activationState, pollActivation };
}
