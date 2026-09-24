import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~~/types/database';

/**
 * Web Push lifecycle shared by usePushNotifications and useAuth. Lives in
 * utils, not in the composable, so useAuth does not have to call
 * usePushNotifications (which itself calls useAuth). Contract:
 * .claude/rules/push-notifications.md.
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

/**
 * Save `sub` as the signed-in user's push subscription. The RPC takes the
 * endpoint over from any previous owner; a browser keeps its endpoint across
 * sign-ins, so a direct upsert on another user's endpoint would fail RLS.
 */
export async function claimPushSubscription(supabase: SupabaseClient<Database>, sub: PushSubscription) {
  return supabase.rpc('claim_push_subscription', {
    p_endpoint: sub.endpoint,
    p_keys: sub.toJSON().keys as Record<string, string>,
    p_user_agent: navigator.userAgent,
  });
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
 */
export async function removePushSubscription(
  supabase: SupabaseClient<Database>,
  sub: PushSubscription
): Promise<PushRemovalResult> {
  const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);

  let unsubscribeError: unknown = null;
  try {
    await sub.unsubscribe();
  } catch (e) {
    unsubscribeError = e;
  }

  return { deleteError, unsubscribeError };
}

/**
 * Sign-out step 1, BEFORE auth.signOut() while the session can still pass RLS:
 * delete this browser's push row. Without it the row stays owned by the
 * previous user and their notifications keep reaching this browser.
 *
 * Returns the subscription whose row was deleted, so the caller can put the
 * row back with claimPushSubscription() if auth.signOut() then fails. Returns
 * null when there was nothing to delete, the delete failed, or the timeout
 * won. It does NOT unsubscribe the browser: that happens only after a
 * successful sign-out (unsubscribeBrowserPush), so a failed sign-out leaves
 * push working.
 *
 * Never throws and never takes longer than `timeoutMs`. After the timeout it
 * skips the delete instead of running on under a later session.
 */
export async function detachBrowserPushRow(
  supabase: SupabaseClient<Database>,
  timeoutMs: number = PUSH_SIGN_OUT_CLEANUP_TIMEOUT_MS
): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  let timedOut = false;
  const detach = async (): Promise<PushSubscription | null> => {
    const sub = await getBrowserPushSubscription();
    if (!sub || timedOut) return null;
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    if (error) {
      console.warn('Deleting the push row on sign-out failed:', error);
      return null;
    }
    return sub;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([detach(), timeout]);
  } catch (e) {
    console.warn('Push cleanup on sign-out failed:', e);
    return null;
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
 * to turn push on again. Also sign-out step 2, after a successful
 * auth.signOut(). Never throws.
 */
export async function unsubscribeBrowserPush(isStillSignedOut: () => boolean = () => true): Promise<void> {
  try {
    const sub = await getBrowserPushSubscription();
    // A lookup that stalled until someone signed in again must not kill the
    // subscription that user may have just claimed.
    if (sub && isStillSignedOut()) await sub.unsubscribe();
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
