/**
 * The site's service worker. It does ONE job: Web Push. It has no `fetch`
 * listener, so it never serves a request from cache; every request goes to the
 * network exactly as if no worker were installed. Do not add caching here
 * without a design doc: the 2024 caching worker is why the site shipped a
 * self-destroying worker for two years. Rules: .claude/rules/push-notifications.md.
 *
 * Registered only by `ensurePushServiceWorker()` when a user turns push on;
 * visitors who never do get no worker at all.
 */
import { buildNotification, isSamePage, parsePushData, resolveClickUrl } from './push';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Activate a new version at once. No clients.claim(): nothing here needs to
// control pages, and taking control of open tabs is what makes update code
// reload them.
sw.addEventListener('install', () => {
  void sw.skipWaiting();
});

// Clear Cache Storage left by the old Workbox worker in browsers that never ran
// the self-destroying one. This worker stores nothing there itself.
sw.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))));
});

sw.addEventListener('push', (event) => {
  const { title, options } = buildNotification(parsePushData(event.data));
  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = resolveClickUrl(event.notification.data?.url, sw.location.origin);
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => isSamePage(w.url, url));
      return open ? open.focus() : sw.clients.openWindow(url);
    })
  );
});
