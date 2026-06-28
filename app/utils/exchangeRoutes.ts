// Single source of truth for "what counts as the Mini Exchange" at the route
// level, so the cutover flag-gate and the onboarding gate can't drift apart.
//
// EXCHANGE_PREFIXES — the marketplace surfaces a logged-in user must have a
// completed profile to use: the /exchange section plus the user's own
// marketplace management tabs under /dashboard. Both the flag-gate (hide
// pre-cutover) and the onboarding-gate (require a complete account) apply here.
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

/** True when `path` equals or sits under any of `prefixes`. */
export function pathInPrefixes(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
