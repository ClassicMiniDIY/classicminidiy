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

/**
 * Hosts whose links open on this site. process-notifications builds URLs from
 * SITE_URL, which defaults to the bare domain, while the site (and so the
 * worker) lives on www; the bare domain 301s there.
 */
export const SITE_HOSTS = ['classicminidiy.com', 'www.classicminidiy.com'];

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
    if (typeof parsed === 'string') return parsed ? { body: parsed } : {};
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
 * The page to open when the user clicks a notification, always on the worker's
 * own origin. A relative URL, or an http(s) URL on one of SITE_HOSTS or on the
 * worker's host, keeps its path, query and hash, rebuilt on `origin` (so a
 * bare-domain link opens on www without a redirect and can match an open tab).
 * Anything else (another site, javascript:, data:) opens the site root.
 */
export function resolveClickUrl(raw: unknown, origin: string): string {
  const base = new URL('/', origin);
  if (typeof raw !== 'string' || !raw) return base.href;
  try {
    const url = new URL(raw, origin);
    const web = url.protocol === 'https:' || url.protocol === 'http:';
    const ours = url.host === base.host || SITE_HOSTS.includes(url.hostname);
    return web && ours ? new URL(url.pathname + url.search + url.hash, origin).href : base.href;
  } catch {
    return base.href;
  }
}

/** Runtime cache names of the pre-2024-03 Workbox worker (nuxt.config.ts history). */
const LEGACY_RUNTIME_CACHES = ['s3-assets', 'supabase-storage', 'images', 'static-resources', 'google-fonts'];

/** True for a Cache Storage name the old Workbox worker created. */
export function isLegacyWorkboxCache(name: string): boolean {
  return name.startsWith('workbox-') || LEGACY_RUNTIME_CACHES.includes(name);
}

/** True when two URLs name the same page, ignoring the #fragment. */
export function isSamePage(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0];
}
