import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~~/types/database';

/**
 * Web Push teardown shared by usePushNotifications().unsubscribe and
 * useAuth().signOut. Lives in utils, not in the composable, so useAuth does
 * not have to call usePushNotifications (which itself calls useAuth).
 */

/** Upper bound on push cleanup during sign-out. Sign-out never waits longer. */
export const PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS = 3000;

/**
 * Delete this browser's `push_subscriptions` row (by its UNIQUE endpoint) and
 * unsubscribe it at the push service. The row delete needs a live session: RLS
 * only lets the owner delete it. The browser unsubscribe runs even when the
 * delete fails, because a dead endpoint stops delivery on its own and the next
 * subscribe() gets a fresh endpoint. The delete error is thrown afterwards.
 */
export async function removePushSubscription(supabase: SupabaseClient<Database>, sub: PushSubscription): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
  if (error) throw error;
}

/**
 * Best-effort push cleanup for sign-out. Call it BEFORE auth.signOut(), while
 * the session is still valid. Without it the endpoint row stays owned by the
 * previous user: their notifications keep reaching this browser, and the next
 * user's upsert on the same endpoint fails RLS.
 *
 * Never throws and never takes longer than `timeoutMs`.
 */
export async function removeBrowserPushSubscription(
  supabase: SupabaseClient<Database>,
  timeoutMs: number = PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS
): Promise<void> {
  if (!import.meta.client) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const cleanup = async () => {
    // getRegistration() resolves undefined at once when no service worker is
    // registered; `serviceWorker.ready` would wait for the full timeout.
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (sub) await removePushSubscription(supabase, sub);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });

  try {
    await Promise.race([cleanup(), timeout]);
  } catch (e) {
    console.warn('Push subscription cleanup on sign-out failed:', e);
  } finally {
    clearTimeout(timer);
  }
}
