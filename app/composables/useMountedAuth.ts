/**
 * Auth state that is safe to branch a TEMPLATE on.
 *
 * The Supabase session lives in localStorage, so everything `useAuth()` exposes
 * is false-or-null during SSR and flips once `initAuth()` runs on the client. A
 * `v-if`/`v-else` pair on the raw value makes the server emit one subtree and
 * the client's first render want another — and Vue's hydration repair MERGES
 * them rather than replacing one.
 *
 * That merge is not "a flash of the wrong content". It is structural DOM
 * corruption: in `MainNav` it left the signed-out wrapper in place and patched
 * the account `<ul class="dropdown-content">` into it, orphaned from any
 * `.dropdown`. Every rule that positions or hides a menu is scoped
 * `.dropdown … .dropdown-content`, so the orphan lost `position: absolute` AND
 * its closed-state `display: none` at once, and took the neighbouring language
 * dropdown down with it. See the dropdown invariants in CLAUDE.md.
 *
 * Every value here folds in a mount check, so the server and the client's first
 * render agree (signed out) and the switch to signed-in happens afterwards as an
 * ordinary reactive update.
 *
 * ```vue
 * const { isSignedIn } = useMountedAuth();
 * <div v-if="isSignedIn">…</div>   // safe
 * <div v-if="isAuthenticated">…</div>  // NOT safe — this is the bug
 * ```
 *
 * `tests/static/hydration-auth-gates.test.ts` enforces this: it walks the real
 * template AST and fails on a structural branch over an ungated auth name.
 *
 * Not a replacement for `<ClientOnly>`. Reach for that when the pre-mount frame
 * would look wrong rather than merely signed-out — `app/pages/membership/index.vue`
 * and `app/pages/dashboard.vue` both render a resolving state instead of
 * flashing a sign-in CTA at a member.
 */
export const useMountedAuth = () => {
  const { user, userProfile, isAuthenticated, isAdmin, isSustainingMember, loading } = useAuth();

  const hasMounted = ref(false);
  onMounted(() => {
    hasMounted.value = true;
  });

  return {
    /** True once the component has mounted on the client. */
    hasMounted,
    /** Auth has both mounted AND finished resolving — use for a three-state UI. */
    authReady: computed(() => hasMounted.value && !loading.value),
    isSignedIn: computed(() => hasMounted.value && isAuthenticated.value),
    isAdminUser: computed(() => hasMounted.value && isAdmin.value),
    isSustainingMemberUser: computed(() => hasMounted.value && isSustainingMember.value),
    /** The user, or null until mounted. Safe in a `v-if`. */
    mountedUser: computed(() => (hasMounted.value ? user.value : null)),
    /** The profile, or null until mounted. Safe in a `v-if`. */
    mountedProfile: computed(() => (hasMounted.value ? userProfile.value : null)),
  };
};
