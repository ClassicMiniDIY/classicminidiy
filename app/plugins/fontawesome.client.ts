// Coordinate the Font Awesome Kit lifecycle so icons reliably render without
// causing hydration churn.
//
// nuxt.config.ts sets `window.FontAwesomeConfig = { autoReplaceSvg: false,
// observeMutations: false }` BEFORE the kit script loads, which prevents the
// kit from sweeping <i> tags during/around Vue hydration (that swap caused
// page-flashing as Vue tore down and re-patched the affected subtrees).
//
// This plugin's job is to re-enable Font Awesome's normal behaviour AFTER
// hydration is complete so:
//   1. Existing <i> tags get converted to <svg> once the kit has loaded.
//   2. Any <i> tags rendered later (route changes, modals, lazy components,
//      reactive list updates) get converted automatically — no manual
//      i2svg() call from the rendering component required.
//
// The previous version polled for `window.FontAwesome` for 5 seconds and
// gave up, which intermittently failed on slow networks where the deferred
// kit script took longer to load. We now (a) listen for the script's load
// event so we react deterministically the moment FA arrives, (b) keep a
// no-op-cheap polling fallback running for up to 30 seconds for the rare
// case where the load event has already fired before we attached, and
// (c) turn on FA's MutationObserver once so subsequent renders are
// handled automatically.
export default defineNuxtPlugin((nuxtApp) => {
  let enabled = false;
  // `arming` tracks whether we're already in the "waiting for the kit to
  // load" phase. Without it, a `page:finish` hook firing during rapid
  // navigation (while the kit is still loading on a slow connection)
  // would attach a second `script` load listener and start a parallel
  // polling interval — wasteful, and a small leak until the kit finally
  // resolves and both copies fire enableFa().
  let arming = false;

  const enableFa = (): boolean => {
    if (enabled) return true;
    const FA = (window as any).FontAwesome;
    if (!FA) return false;

    // Re-enable mutation observation now that hydration is done so any new
    // <i class="fas fa-*"> tags rendered after this point are automatically
    // converted by FA itself — no need to manually call i2svg() in
    // components that render icons reactively.
    if (FA.config) {
      FA.config.autoReplaceSvg = 'nest';
      FA.config.observeMutations = true;
    }

    // One-time sweep of any existing static markup.
    if (FA.dom?.i2svg) FA.dom.i2svg();
    // Start the MutationObserver explicitly — some versions of the kit
    // need an explicit kick once `observeMutations` flips from false → true
    // post-init.
    if (FA.dom?.watch) FA.dom.watch();

    enabled = true;
    return true;
  };

  const armEnable = () => {
    if (enabled || arming) return;
    if (enableFa()) return;

    arming = true;

    const finish = () => {
      arming = false;
    };

    // Deterministic path: react when the kit script finishes loading.
    const script = document.querySelector(
      'script[src*="kit.fontawesome.com"], script[src*="ka-f.fontawesome.com"]'
    ) as HTMLScriptElement | null;
    if (script) {
      script.addEventListener(
        'load',
        () => {
          enableFa();
          finish();
        },
        { once: true }
      );
    }

    // Defensive fallback: if the load event already fired (script may have
    // resolved between hook firing and our listener attaching) or if the
    // kit takes longer than expected (slow/congested CDN), poll for up to
    // 30 seconds. Cheap — a single property read on window every 100ms.
    let attempts = 0;
    const MAX_ATTEMPTS = 300; // 300 × 100ms = 30s
    const interval = window.setInterval(() => {
      attempts += 1;
      if (enableFa() || attempts >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
        finish();
      }
    }, 100);
  };

  nuxtApp.hook('app:suspense:resolve', armEnable);

  // Belt-and-suspenders re-sweep on page navigation. With observeMutations
  // turned on this is mostly redundant, but it cheaply catches any edge
  // case where the observer hasn't been wired up yet (e.g. very first
  // navigation while FA is still loading) without causing rework when it
  // has — i2svg() is idempotent on already-converted markup.
  nuxtApp.hook('page:finish', () => {
    if (!enabled) {
      armEnable();
      return;
    }
    const FA = (window as any).FontAwesome;
    if (FA?.dom?.i2svg) FA.dom.i2svg();
  });
});
