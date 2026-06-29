import { getServiceClient } from '../supabase';

/**
 * Notification queue utilities for The Mini Exchange
 *
 * Provides fire-and-forget notification queueing that inserts into the
 * `notification_queue` database table. Errors are logged but never thrown,
 * ensuring that a failed enqueue never breaks the calling API route.
 *
 * The process-notifications edge function (classicminidiy-supabase) renders each
 * event_type to an SES email. New types must also be whitelisted in the
 * `notification_queue.valid_event_type` CHECK constraint (migration
 * 20260628000001) or the insert is rejected.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-user events (one recipient). Recipient = the affected user. */
export type EventType =
  | 'new_message'
  | 'new_comment'
  | 'comment_reply'
  | 'listing_status'
  | 'saved_search_match'
  | 'listing_submitted'
  | 'seller_inquiry'
  | 'watchlist_sold'
  | 'price_drop';

/** Admin fan-out events (one row per admin). Enqueued via queueAdminNotification. */
export type AdminEventType = 'admin_listing_pending' | 'admin_wanted_pending' | 'admin_find_pending';

export type Channel = 'email' | 'push' | 'both';

export interface QueueNotificationParams {
  userId: string;
  eventType: EventType;
  payload: Record<string, any>;
  channel?: Channel; // defaults to 'email'
  batchKey: string;
}

// ---------------------------------------------------------------------------
// Batch key builder
// ---------------------------------------------------------------------------

/**
 * Build a consistent batch key for grouping related notifications.
 *
 * Mapping:
 *  - 'new_message'        + { conversationId }   -> 'msg:{conversationId}'
 *  - 'new_comment'        + { listingId }         -> 'comment:{listingId}'
 *  - 'comment_reply'      + { parentCommentId }   -> 'reply:{parentCommentId}'
 *  - 'listing_status'     + { listingId }         -> 'status:{listingId}'
 *  - 'saved_search_match' + { userId }            -> 'saved_search:{userId}'
 *  - 'listing_submitted'  + { listingId }         -> 'listing_submitted:{listingId}'
 *  - 'seller_inquiry'     + { inquiryId }         -> 'seller_inquiry:{inquiryId}' (unique per inquiry)
 *  - 'watchlist_sold'     + { listingId }         -> 'watchlist_sold:{listingId}'
 *  - 'price_drop'         + { listingId }         -> 'price_drop:{listingId}'
 */
export function buildBatchKey(eventType: EventType, context: Record<string, string>): string {
  switch (eventType) {
    case 'new_message':
      return `msg:${context.conversationId}`;
    case 'new_comment':
      return `comment:${context.listingId}`;
    case 'comment_reply':
      return `reply:${context.parentCommentId}`;
    case 'listing_status':
      return `status:${context.listingId}`;
    case 'saved_search_match':
      return `saved_search:${context.userId}`;
    case 'listing_submitted':
      return `listing_submitted:${context.listingId}`;
    case 'seller_inquiry':
      // Unique per inquiry — seller inquiries must never batch (each would be
      // dropped to the first item by the digest builder).
      return `seller_inquiry:${context.inquiryId}`;
    case 'watchlist_sold':
      return `watchlist_sold:${context.listingId}`;
    case 'price_drop':
      return `price_drop:${context.listingId}`;
  }
}

// ---------------------------------------------------------------------------
// Queue insertion
// ---------------------------------------------------------------------------

/**
 * Insert a notification into the `notification_queue` table.
 *
 * Uses the Supabase service-role client so it bypasses RLS.
 * On failure the error is logged but **never** thrown — this is intentionally
 * fire-and-forget so that a queue failure cannot break the calling endpoint.
 */
export async function queueNotification(params: QueueNotificationParams): Promise<void> {
  const { userId, eventType, payload, channel = 'email', batchKey } = params;

  try {
    // CMDIY service-role client (reads SUPABASE_SERVICE_KEY) — replaces TME's
    // createClient(config.public.supabaseUrl, config.supabaseServiceKey).
    const supabase = getServiceClient();

    const { error } = await supabase.from('notification_queue').insert({
      user_id: userId,
      event_type: eventType,
      payload,
      channel,
      batch_key: batchKey,
    });

    if (error) {
      console.error('[NotificationQueue] Failed to insert notification:', error);
    }
  } catch (err) {
    console.error('[NotificationQueue] Unexpected error queueing notification:', err);
  }
}

/**
 * Fan an admin notification out to every active admin — one queue row per admin
 * (the queue keys notifications by recipient user_id). All rows share a batch key
 * so the process-notifications digest groups a window's items into one email per
 * admin. `email` channel only; fire-and-forget like queueNotification.
 *
 * batchKey defaults to the event type (stable → digest grouping). Pass a custom
 * key only if you want a tighter grouping window.
 */
export async function queueAdminNotification(params: {
  eventType: AdminEventType;
  payload: Record<string, any>;
  batchKey?: string;
}): Promise<void> {
  const { eventType, payload, batchKey } = params;

  try {
    const supabase = getServiceClient();

    const { data: admins, error: adminErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
      .eq('is_banned', false);

    if (adminErr) {
      console.error('[NotificationQueue] Failed to resolve admins:', adminErr);
      return;
    }
    if (!admins || admins.length === 0) return;

    const key = batchKey ?? eventType;
    const rows = admins.map((a: { id: string }) => ({
      user_id: a.id,
      event_type: eventType,
      payload,
      channel: 'email' as const,
      batch_key: key,
    }));

    const { error } = await supabase.from('notification_queue').insert(rows);
    if (error) {
      console.error('[NotificationQueue] Failed to insert admin notifications:', error);
    }
  } catch (err) {
    console.error('[NotificationQueue] Unexpected error queueing admin notification:', err);
  }
}
