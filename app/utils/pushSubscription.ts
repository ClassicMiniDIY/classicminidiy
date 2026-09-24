import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~~/types/database';

/**
 * Web Push teardown shared by usePushNotifications().unsubscribe and
 * useAuth().signOut. Lives in utils, not in the composable, so useAuth does
 * not have to call usePushNotifications (which itself calls useAuth).
 */

/** Upper bound on push cleanup during sign-out. Sign-out never waits longer. */
export const PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS = 3000;

/** True in a browser that supports Web Push; false during SSR. */
export function isWebPushSupported(): boolean {
  return import.meta.client && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * This browser's current push subscription, or null when Web Push is not
 * supported or there is none. Uses getRegistration(), which resolves at once
 * when no service worker is registered; `serviceWorker.ready` would wait
 * forever. May reject.
 */
export async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

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
  if (!isWebPushSupported()) return;

  const controller = new AbortController();

  const cleanup = async () => {
    const sub = await getBrowserPushSubscription();
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

/**
 * Unsubscribe this browser from Web Push without touching the database. For
 * any auth event that arrives without a session. subscribe() needs a signed-in
 * user, so a subscription with no session behind it belongs to a session that
 * ended without signOut() (an expired or revoked refresh token, a sign-out in
 * another tab, or one that died while no tab was open). RLS would refuse a row
 * delete by then. A dead endpoint is enough: the push service stops delivery,
 * process-notifications prunes the row on the 410, and the next subscribe()
 * gets a fresh endpoint. Trade-off: after an involuntary sign-out the user has
 * to turn push on again. Never throws.
 */
export async function unsubscribeBrowserPush(): Promise<void> {
  try {
    const sub = await getBrowserPushSubscription();
    await sub?.unsubscribe();
  } catch (e) {
    console.warn('Push unsubscribe without a session failed:', e);
  }
}

/**
 * Unsubscribe `sub` when the signed-in user does not own its row. A browser
 * keeps its endpoint across sign-ins, so a subscription the current user has
 * no row for was made by a previous user of this browser, and that user's
 * notifications may still reach it. It is dropped, never claimed: claiming
 * would turn push on for the new user without their consent.
 *
 * Returns true when the subscription was dropped. When ownership cannot be
 * read (a network or query error) the subscription is left alone.
 */
export async function dropUnownedPushSubscription(
  supabase: SupabaseClient<Database>,
  sub: PushSubscription
): Promise<boolean> {
  // RLS returns only the caller's own rows, so "no row" means "not mine".
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', sub.endpoint)
    .maybeSingle();
  if (error || data) return false;

  try {
    await sub.unsubscribe();
  } catch (e) {
    console.warn('Unsubscribing a push subscription this user does not own failed:', e);
  }
  return true;
}

/**
 * Session-start check for the auth listener: drop this browser's push
 * subscription when the signed-in user does not own it. Never throws.
 */
export async function reconcileBrowserPush(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const sub = await getBrowserPushSubscription();
    if (sub) await dropUnownedPushSubscription(supabase, sub);
  } catch (e) {
    console.warn('Push ownership check failed:', e);
  }
}
