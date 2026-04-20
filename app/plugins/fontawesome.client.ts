// Trigger Font Awesome <i>→<svg> replacement AFTER Vue hydration is complete.
// Initial replacement is disabled via window.FontAwesomeConfig in nuxt.config.ts
// to prevent hydration mismatches.
export default defineNuxtPlugin((nuxtApp) => {
  const replaceIcons = () => {
    const FA = (window as any).FontAwesome;
    if (FA?.dom?.i2svg) {
      FA.dom.i2svg();
    }
  };

  nuxtApp.hook('app:suspense:resolve', () => {
    // Wait for the FA kit script to finish loading, then replace on each nav.
    if ((window as any).FontAwesome) {
      replaceIcons();
    } else {
      const interval = setInterval(() => {
        if ((window as any).FontAwesome) {
          clearInterval(interval);
          replaceIcons();
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
    }
  });

  nuxtApp.hook('page:finish', () => {
    replaceIcons();
  });
});
