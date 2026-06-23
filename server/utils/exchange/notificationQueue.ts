import { getServiceClient } from '../supabase';

/**
 * Notification queue utilities for The Mini Exchange
 *
 * Provides fire-and-forget notification queueing that inserts into the
 * `notification_queue` database table. Errors are logged but never thrown,
 * ensuring that a failed enqueue never breaks the calling API route.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType = 'new_message' | 'new_comment' | 'comment_reply' | 'listing_status' | 'saved_search_match';

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
