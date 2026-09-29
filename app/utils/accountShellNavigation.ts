/** Routed account shells: a parent page whose children render inside <AccountShell>. */
const ACCOUNT_SHELLS = new Set(['dashboard', 'settings']);

const firstSegment = (path: string) => path.split('/')[1] ?? '';

/**
 * True when a navigation only changes the section inside one account shell,
 * e.g. /settings/membership -> /settings/api-keys. The parent page stays mounted
 * and only the section content re-renders; `app/plugins/account-shell-navigation.client.ts`
 * uses this to skip the page-level scroll-to-top and view transition.
 */
export function isAccountShellSectionChange(to: { path: string }, from: { path: string }): boolean {
  const shell = firstSegment(to.path);
  return ACCOUNT_SHELLS.has(shell) && shell === firstSegment(from.path) && to.path !== from.path;
}
