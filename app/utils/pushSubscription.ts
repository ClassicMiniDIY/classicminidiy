import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~~/types/database';

/**
 * Web Push teardown shared by usePushNotifications().unsubscribe and
 * useAuth().signOut. Lives in utils, not in the composable, so useAuth does
 * not have to call usePushNotifications (which itself calls useAuth).
 */

/** Upper bound on push cleanup during sign-out. Sign-out never waits longer. */
export const PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS = 3000;

export interface PushRemovalResult {
  /** The row delete failed; the row may still exist. */
  deleteError: unknown;
  /** The browser unsubscribe failed; the endpoint may still be live. */
  unsubscribeError: unknown;
}

/**
 * Delete this browser's `push_subscriptions` row (by its UNIQUE endpoint) and
 * unsubscribe it at the push service. The row delete needs a live session: RLS
 * only lets the owner delete it. The browser unsubscribe runs even when the
 * delete fails, because a dead endpoint stops delivery on its own
 * (process-notifications prunes rows on 410) and the next subscribe() gets a
 * fresh endpoint.
 *
 * Never throws. Either step succeeding stops delivery, so callers decide what
 * a partial failure means from the returned errors.
 *
 * `signal`: when aborted before the delete returns, the browser unsubscribe is
 * skipped, so a late cleanup cannot kill an endpoint the next user now owns.
 */
export async function removePushSubscription(
  supabase: SupabaseClient<Database>,
  sub: PushSubscription,
  signal?: AbortSignal
): Promise<PushRemovalResult> {
  const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);

  let unsubscribeError: unknown = null;
  if (!signal?.aborted) {
    try {
      await sub.unsubscribe();
    } catch (e) {
      unsubscribeError = e;
    }
  }

  return { deleteError, unsubscribeError };
}

/**
 * Best-effort push cleanup for sign-out. Call it BEFORE auth.signOut(), while
 * the session is still valid. Without it the endpoint row stays owned by the
 * previous user: their notifications keep reaching this browser, and the next
 * user's upsert on the same endpoint fails RLS.
 *
 * Never throws and never takes longer than `timeoutMs`. After the timeout the
 * cleanup stops at its next step instead of running on under a later session.
 */
export async function removeBrowserPushSubscription(
  supabase: SupabaseClient<Database>,
  timeoutMs: number = PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS
): Promise<void> {
  if (!import.meta.client) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const controller = new AbortController();

  const cleanup = async () => {
    // getRegistration() resolves undefined at once when no service worker is
    // registered; `serviceWorker.ready` would wait for the full timeout.
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || controller.signal.aborted) return;
    const sub = await registration.pushManager.getSubscription();
    if (!sub || controller.signal.aborted) return;

    const { deleteError, unsubscribeError } = await removePushSubscription(supabase, sub, controller.signal);
    if (deleteError || unsubscribeError) {
      console.warn('Push subscription cleanup on sign-out was partial:', { deleteError, unsubscribeError });
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, timeoutMs);
  });

  try {
    await Promise.race([cleanup(), timeout]);
  } catch (e) {
    console.warn('Push subscription cleanup on sign-out failed:', e);
  } finally {
    clearTimeout(timer);
  }
}
