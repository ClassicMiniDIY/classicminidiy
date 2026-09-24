import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// service-worker/sw.ts wiring: which events it handles and what each does.
// The worker registers listeners on `self` at import, so each test stubs a
// fake ServiceWorkerGlobalScope and imports a fresh copy.

type Listener = (event: any) => void;

let listeners: Record<string, Listener>;
let scope: any;
let cacheStore: { keys: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

const extendable = (extra: Record<string, unknown> = {}) => {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: vi.fn((p: Promise<unknown>) => pending.push(p)), pending, ...extra };
};

beforeEach(async () => {
  listeners = {};
  scope = {
    addEventListener: vi.fn((type: string, fn: Listener) => (listeners[type] = fn)),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(null),
      claim: vi.fn(),
    },
    location: { origin: 'https://www.classicminidiy.com' },
  };
  cacheStore = {
    keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'images']),
    delete: vi.fn().mockResolvedValue(true),
  };
  vi.stubGlobal('self', scope);
  vi.stubGlobal('caches', cacheStore);
  vi.resetModules();
  await import('../../../service-worker/sw');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push service worker', () => {
  it('handles install, activate, push and notificationclick, and never fetch', () => {
    expect(Object.keys(listeners).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']);
    // No fetch listener: the worker must never serve a request from cache.
    expect(listeners.fetch).toBeUndefined();
  });

  it('activates at once on install, without claiming open pages', () => {
    listeners.install!({});
    expect(scope.skipWaiting).toHaveBeenCalled();
    expect(scope.clients.claim).not.toHaveBeenCalled();
  });

  it('clears Cache Storage left by the old caching worker on activate', async () => {
    const event = extendable();
    listeners.activate!(event);
    await Promise.all(event.pending);
    expect(cacheStore.delete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(cacheStore.delete).toHaveBeenCalledWith('images');
  });

  it('shows a notification for every push, inside waitUntil', async () => {
    const payload = { title: 'Message from Alex', body: 'Hello', url: '/exchange/messages/c1', tag: 'msg:c1' };
    const event = extendable({ data: { json: () => payload, text: () => JSON.stringify(payload) } });
    listeners.push!(event);
    await Promise.all(event.pending);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    expect(scope.registration.showNotification).toHaveBeenCalledWith(
      'Message from Alex',
      expect.objectContaining({ body: 'Hello', tag: 'msg:c1', data: { url: '/exchange/messages/c1' } })
    );
  });

  it('still shows a notification for a push with no data', async () => {
    const event = extendable({ data: null });
    listeners.push!(event);
    await Promise.all(event.pending);
    expect(scope.registration.showNotification).toHaveBeenCalledWith('Classic Mini DIY', expect.any(Object));
  });

  it('focuses an open tab on the notification URL', async () => {
    const tab = { url: 'https://www.classicminidiy.com/exchange/messages/c1', focus: vi.fn() };
    scope.clients.matchAll.mockResolvedValue([tab]);
    const notification = { close: vi.fn(), data: { url: '/exchange/messages/c1' } };
    const event = extendable({ notification });
    listeners.notificationclick!(event);
    await Promise.all(event.pending);
    expect(notification.close).toHaveBeenCalled();
    expect(tab.focus).toHaveBeenCalled();
    expect(scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when no tab shows the URL, and never a non-http URL', async () => {
    const event = extendable({ notification: { close: vi.fn(), data: { url: 'javascript:alert(1)' } } });
    listeners.notificationclick!(event);
    await Promise.all(event.pending);
    expect(scope.clients.openWindow).toHaveBeenCalledWith('https://www.classicminidiy.com/');
  });
});
