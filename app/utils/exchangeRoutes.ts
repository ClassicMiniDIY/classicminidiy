// Single source of truth for "what counts as the Mini Exchange" at the route
// level, so the cutover flag-gate and the onboarding gate can't drift apart.
//
// EXCHANGE_PREFIXES — the marketplace surfaces the cutover flag hides pre-launch:
// the /exchange section plus the user's own marketplace management tabs under
// /dashboard. These are open to BROWSE for everyone once live; onboarding is NOT
// required to view them (see EXCHANGE_ONBOARDING_PREFIXES for what actually needs
// a completed profile).
export const EXCHANGE_PREFIXES = [
  '/exchange',
  '/dashboard/listings',
  '/dashboard/wanted',
  '/dashboard/notifications',
  '/dashboard/saved-searches',
];

// Routes that the cutover flag must ALSO hide pre-launch, but that the
// onboarding gate must NOT force through onboarding:
//  - /onboarding is the gate's own target (gating it would loop).
//  - /admin/exchange is internal moderation tooling reached via is_admin;
//    admins shouldn't be bounced through buyer/seller onboarding.
export const EXCHANGE_FLAG_PREFIXES = [...EXCHANGE_PREFIXES, '/onboarding', '/admin/exchange'];

// Routes that REQUIRE a completed profile to *act* — list, post a want, submit a
// find, message. Everything else in the Exchange (landing, browse + detail pages,
// feeds, dashboard tabs) stays open to everyone — anonymous OR logged-in,
// onboarded or not — so the marketplace is fully viewable and existing users are
// never walled out of browsing. Onboarding is DRIVEN by the soft nudge
// (OnboardingNudge) and enforced here only at the point of action.
export const EXCHANGE_ONBOARDING_PREFIXES = [
  '/exchange/listings/new',
  '/exchange/listings/bulk',
  '/exchange/wanted/new',
  '/exchange/finds/submit',
  '/exchange/messages',
];

/** True when `path` equals or sits under any of `prefixes`. */
export function pathInPrefixes(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
