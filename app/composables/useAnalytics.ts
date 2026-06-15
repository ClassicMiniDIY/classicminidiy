/**
 * useAnalytics — typed helpers over usePostHog() for consistent event capture.
 *
 * Use the specific helpers (trackOutbound, trackSearch, trackDownload, the
 * form.* helpers) for the cross-cutting event families so properties stay
 * uniform and queryable in PostHog. Use track() for one-off bespoke events.
 *
 * Domain events that predate this composable (calculator_used, decoder_used,
 * chat_message_sent, gearbox_config_*, promo_*, language_changed, etc.) keep
 * using capture() directly — don't churn them just to route through here.
 */
type Props = Record<string, unknown>;

export function useAnalytics() {
  const { capture, identify, reset } = usePostHog();

  // ---- Identity -------------------------------------------------------
  /** Tie all subsequent events to a known user. Call on auth success. */
  function identifyUser(userId: string, props?: Props) {
    if (!userId) return;
    identify(userId, props);
  }

  /** Clear identity so the next session isn't merged with this one. Call on logout. */
  function resetIdentity() {
    reset();
  }

  // ---- Generic --------------------------------------------------------
  /** Escape hatch for bespoke one-off events with no dedicated helper. */
  function track(event: string, props?: Props) {
    capture(event, props);
  }

  // ---- Outbound links -------------------------------------------------
  /**
   * Any click that leaves the site (YouTube, social, partner/affiliate,
   * external reference). `group` buckets them (e.g. 'youtube_video',
   * 'footer_social', 'community_nav', 'reference', 'partner', 'chat_useful_link').
   */
  function trackOutbound(opts: { destination: string; label?: string; group?: string; location?: string }) {
    capture('outbound_link_clicked', {
      destination: opts.destination,
      label: opts.label,
      group: opts.group,
      location: opts.location,
    });
  }

  // ---- Search ---------------------------------------------------------
  /**
   * Fuse.js / table search. Wire into the already-debounced handler and call
   * after results are computed. Empty/whitespace queries are ignored.
   */
  function trackSearch(surface: string, query: string, resultsCount?: number, extra?: Props) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return;
    capture('search_performed', {
      surface,
      query: trimmed,
      results_count: resultsCount,
      ...extra,
    });
  }

  // ---- Downloads ------------------------------------------------------
  /** Manual / document / diagram / map downloads — core value delivery. */
  function trackDownload(opts: {
    document_id?: string | number;
    slug?: string;
    file_type?: string;
    name?: string;
    location?: string;
    group?: string;
  }) {
    capture('document_downloaded', { ...opts });
  }

  // ---- GEO / AI referral ----------------------------------------------
  /**
   * Fire when a visit is attributed to an AI answer engine (ChatGPT, Perplexity,
   * Gemini, Claude, Copilot). The entry referral is auto-detected + registered as
   * the `ai_source` super-property in app/plugins/posthog.ts; this helper is for
   * any explicit/in-app attribution (e.g. a deep-linked AI citation landing).
   */
  function trackAiReferral(source: string, props?: Props) {
    if (!source) return;
    capture('ai_referral', { ai_source: source, ...props });
  }

  // ---- Forms / funnels ------------------------------------------------
  /** Fire once on first meaningful interaction so abandonment is measurable. */
  function trackFormStarted(form: string, props?: Props) {
    capture('form_started', { form, ...props });
  }
  function trackFormStep(form: string, step: number | string, props?: Props) {
    capture('form_step_changed', { form, step, ...props });
  }
  function trackFormSubmitted(form: string, props?: Props) {
    capture('form_submitted', { form, ...props });
  }
  function trackFormError(form: string, field: string, props?: Props) {
    capture('form_validation_error', { form, field, ...props });
  }

  return {
    capture,
    identify,
    reset,
    track,
    identifyUser,
    resetIdentity,
    trackOutbound,
    trackSearch,
    trackDownload,
    trackAiReferral,
    trackFormStarted,
    trackFormStep,
    trackFormSubmitted,
    trackFormError,
  };
}
