/**
 * Pure helpers for the push service worker (`service-worker/sw.ts`). Nothing
 * here touches worker globals, so unit tests import it directly. Rules:
 * .claude/rules/push-notifications.md.
 *
 * The payload comes from `process-notifications` in classicminidiy-supabase:
 * `{ title, body, url, tag, icon? }` as JSON. Every field is checked, because a
 * push that shows no notification breaks the `userVisibleOnly` promise and the
 * browser may revoke the subscription.
 */

export const DEFAULT_NOTIFICATION_TITLE = 'Classic Mini DIY';
export const DEFAULT_NOTIFICATION_ICON = '/icon.png';

/** The push payload as sent; any field may be missing or of the wrong type. */
export interface PushPayload {
  title?: unknown;
  body?: unknown;
  url?: unknown;
  tag?: unknown;
  icon?: unknown;
}

/** The subset of PushMessageData the worker reads. */
export interface PushDataLike {
  json(): unknown;
  text(): string;
}

export interface NotificationSpec {
  title: string;
  options: NotificationOptions & { renotify?: boolean };
}

const nonEmptyString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/** Read the push data as JSON; plain text becomes the body; nothing becomes {}. */
export function parsePushData(data: PushDataLike | null | undefined): PushPayload {
  if (!data) return {};
  try {
    const parsed = data.json();
    return parsed && typeof parsed === 'object' ? (parsed as PushPayload) : {};
  } catch {
    const text = data.text();
    return text ? { body: text } : {};
  }
}

/** The notification to show for a payload. Always has a title. */
export function buildNotification(payload: PushPayload): NotificationSpec {
  const tag = nonEmptyString(payload.tag);
  return {
    title: nonEmptyString(payload.title) ?? DEFAULT_NOTIFICATION_TITLE,
    options: {
      body: nonEmptyString(payload.body) ?? '',
      icon: nonEmptyString(payload.icon) ?? DEFAULT_NOTIFICATION_ICON,
      tag,
      // A second message in the same conversation replaces the first
      // notification (same tag); renotify makes it alert again.
      renotify: !!tag,
      data: { url: nonEmptyString(payload.url) },
    },
  };
}

/**
 * The page to open when the user clicks a notification: the payload URL when
 * it is http(s), else the site root. A relative URL resolves against the
 * worker's origin. Any other scheme (javascript:, data:) falls back to root.
 */
export function resolveClickUrl(raw: unknown, origin: string): string {
  const fallback = new URL('/', origin).href;
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    const url = new URL(raw, origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : fallback;
  } catch {
    return fallback;
  }
}
