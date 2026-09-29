/**
 * Section changes inside /dashboard and /settings update only the section.
 *
 * Both shells are nested routes, so the parent page (hero, sidebar) stays
 * mounted and only <NuxtPage> swaps. Two page-level defaults made it look like a
 * full reload anyway:
 *  - `experimental.viewTransition` snapshots and cross-fades the WHOLE document
 *    on every navigation, a child route change included;
 *  - Nuxt's default scroll behaviour scrolls to the top on any page change, so
 *    the visitor was thrown back up to the hero.
 *
 * `beforeEach` runs before the view-transition plugin's `beforeResolve`, and
 * `to.meta` is the merged meta object of this one navigation, so setting the two
 * flags here affects only this navigation. <AccountShell> brings the section
 * start into view when the visitor had scrolled past it.
 *
 * A plugin rather than `definePageMeta`: page meta is static (viewTransition
 * takes no function) and the macro is extracted into its own module, where
 * auto-imports do not exist.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();

  // Back/forward must restore the position the browser saved, which Nuxt's
  // scroll behaviour only does when `scrollToTop` is not false. The router's own
  // popstate listener was registered first and runs its guards asynchronously,
  // so this flag is set before `beforeEach` reads it.
  let fromHistory = false;
  window.addEventListener('popstate', () => {
    fromHistory = true;
  });

  router.beforeEach((to, from) => {
    const viaHistory = fromHistory;
    fromHistory = false;
    if (!isAccountShellSectionChange(to, from)) return;
    to.meta.viewTransition = false;
    if (!viaHistory) to.meta.scrollToTop = false;
  });
});
