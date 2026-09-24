import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { createMockUser, setupGlobalMocks, cleanupGlobalMocks } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// usePushNotifications — VAPID web-push subscription lifecycle.
//
// API surface (from app/composables/usePushNotifications.ts):
//   - isSupported            computed<boolean>  (false on server)
//   - subscription           readonly ref<PushSubscription | null>
//   - checkExistingSubscription() => Promise<void>
//   - subscribe()            => Promise<boolean>
//   - unsubscribe()          => Promise<boolean>
//
// Differences from the TME reference test that this port adapts to:
//   - The composable depends on useErrorHandler().handleError (not console),
//     so errors are asserted via a spy on handleError.
//   - subscribe() requires a VAPID public key from
//     useRuntimeConfig().public.vapidPublicKey; a documented "Not Configured"
//     branch exists when it is missing (TME has no such branch).
//   - applicationServerKey is passed as a *decoded Uint8Array*
//     (urlBase64ToUint8Array), NOT the raw base64 string.
//   - unsubscribe() deletes by endpoint when a local subscription exists and
//     deletes nothing otherwise (never by user_id: other devices keep push).
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
let mockHandleError: ReturnType<typeof vi.fn>;

// Push API mocks
let mockPushSubscription: any;
let mockPushManager: any;
let mockRegistration: any;

// A valid base64url VAPID key (decodes cleanly via urlBase64ToUint8Array).
const VAPID_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8';

// Stub useRuntimeConfig with a given public config. Pass an explicit object so
// the absence of `vapidPublicKey` is preserved (a defaulted param would collapse
// `undefined` back to the key and defeat the "Not Configured" branch test).
const stubRuntimeConfig = (publicConfig: Record<string, unknown>) => {
  vi.stubGlobal('useRuntimeConfig', () => ({ public: publicConfig }) as any);
};
const setupRuntimeConfig = () => stubRuntimeConfig({ vapidPublicKey: VAPID_KEY });

beforeEach(() => {
  // Auth + Supabase stubbed by the shared helper (default: authenticated user).
  const setup = setupGlobalMocks({ user: createMockUser() });
  mockSupabase = setup.mockSupabase as ReturnType<typeof createMockSupabaseClient>;

  // Toast + error handler spies (the composable auto-imports both).
  mockToast = { add: vi.fn(), remove: vi.fn(), clear: vi.fn() };
  mockHandleError = vi.fn();
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('useErrorHandler', () => ({ handleError: mockHandleError }));

  setupRuntimeConfig();

  // ----- Web Push browser APIs -----
  mockPushSubscription = {
    endpoint: 'https://push.example.com/subscription/abc123',
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: vi.fn().mockReturnValue({
      endpoint: 'https://push.example.com/subscription/abc123',
      keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
    }),
  };

  mockPushManager = {
    getSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue(mockPushSubscription),
  };

  mockRegistration = { pushManager: mockPushManager };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(mockRegistration),
      getRegistration: vi.fn().mockResolvedValue(mockRegistration),
      register: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  (window as any).PushManager = class MockPushManager {};

  (global as any).Notification = {
    requestPermission: vi.fn().mockResolvedValue('granted'),
    permission: 'default',
  };

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
  delete (window as any).PushManager;
});

const importComposable = async () => {
  const { usePushNotifications } = await import('~/app/composables/usePushNotifications');
  return usePushNotifications;
};

// ===========================================================================
// isSupported
// ===========================================================================
describe('usePushNotifications', () => {
  describe('isSupported', () => {
    it('is true when serviceWorker and PushManager are available', async () => {
      const usePushNotifications = await importComposable();
      const { isSupported } = usePushNotifications();
      expect(isSupported.value).toBe(true);
    });

    it('is false when PushManager is not available', async () => {
      delete (window as any).PushManager;

      const usePushNotifications = await importComposable();
      const { isSupported } = usePushNotifications();
      expect(isSupported.value).toBe(false);
    });

    it('is false when serviceWorker is not available', async () => {
      // happy-dom defines serviceWorker on Navigator.prototype, so the prototype
      // descriptor must be removed (alongside the instance one) to simulate an
      // unsupported browser.
      const proto = Object.getPrototypeOf(navigator);
      const protoDescriptor = Object.getOwnPropertyDescriptor(proto, 'serviceWorker');
      const instanceDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

      if (instanceDescriptor) delete (navigator as any).serviceWorker;
      if (protoDescriptor) delete proto.serviceWorker;

      const usePushNotifications = await importComposable();
      const { isSupported } = usePushNotifications();
      expect(isSupported.value).toBe(false);

      if (protoDescriptor) Object.defineProperty(proto, 'serviceWorker', protoDescriptor);
      if (instanceDescriptor) Object.defineProperty(navigator, 'serviceWorker', instanceDescriptor);
    });
  });

  // =========================================================================
  // checkExistingSubscription
  // =========================================================================
  describe('checkExistingSubscription', () => {
    it('finds and stores an existing push subscription the user owns', async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);
      mockSupabase._queryBuilder.maybeSingle.mockResolvedValue({ data: { id: 'own-row' }, error: null });

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, subscription } = usePushNotifications();

      await checkExistingSubscription();

      expect(mockPushManager.getSubscription).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('endpoint', mockPushSubscription.endpoint);
      expect(subscription.value).toEqual(mockPushSubscription);
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it('drops a subscription left by a previous user of this browser', async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);
      mockSupabase._queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, subscription } = usePushNotifications();

      await checkExistingSubscription();

      // Shown as off and unsubscribed, not claimed for the new user.
      expect(subscription.value).toBeNull();
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('keeps the subscription when ownership cannot be read', async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);
      mockSupabase._queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, subscription } = usePushNotifications();

      await checkExistingSubscription();

      expect(subscription.value).toEqual(mockPushSubscription);
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it('sets subscription to null when none exists', async () => {
      mockPushManager.getSubscription.mockResolvedValue(null);

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, subscription } = usePushNotifications();

      await checkExistingSubscription();

      expect(subscription.value).toBeNull();
    });

    it('does nothing when push is not supported', async () => {
      delete (window as any).PushManager;

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription } = usePushNotifications();

      await checkExistingSubscription();

      expect(mockPushManager.getSubscription).not.toHaveBeenCalled();
    });

    it('handles errors gracefully without showing a toast', async () => {
      mockPushManager.getSubscription.mockRejectedValue(new Error('SW error'));

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, checked } = usePushNotifications();

      await checkExistingSubscription();

      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ showToast: false }));
      expect(mockToast.add).not.toHaveBeenCalled();
      // A failed check is "unknown", so the page must not claim the device is off.
      expect(checked.value).toBe(false);
    });

    it('reads through getRegistration(), not serviceWorker.ready', async () => {
      // `ready` never resolves when no service worker is registered; the
      // check must still finish and report "no subscription".
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: new Promise(() => {}),
          getRegistration: vi.fn().mockResolvedValue(undefined),
          register: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, subscription, checked } = usePushNotifications();

      await checkExistingSubscription();

      expect(subscription.value).toBeNull();
      expect(checked.value).toBe(true);
    });

    it('marks the check done after an owned, a dropped, or no subscription', async () => {
      const usePushNotifications = await importComposable();

      for (const [sub, row] of [
        [mockPushSubscription, { id: 'own-row' }],
        [mockPushSubscription, null],
        [null, null],
      ] as const) {
        mockPushManager.getSubscription.mockResolvedValue(sub);
        mockSupabase._queryBuilder.maybeSingle.mockResolvedValue({ data: row, error: null });
        const { checkExistingSubscription, checked } = usePushNotifications();
        expect(checked.value).toBe(false);
        await checkExistingSubscription();
        expect(checked.value).toBe(true);
      }
    });

    it('reads Notification.permission', async () => {
      (global as any).Notification.permission = 'denied';

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, permission } = usePushNotifications();

      expect(permission.value).toBeNull();
      await checkExistingSubscription();
      expect(permission.value).toBe('denied');
    });

    it('refreshPermission() re-reads Notification.permission', async () => {
      const usePushNotifications = await importComposable();
      const { refreshPermission, permission } = usePushNotifications();

      (global as any).Notification.permission = 'granted';
      refreshPermission();
      expect(permission.value).toBe('granted');
    });

    it('leaves checked false when push is not supported', async () => {
      delete (window as any).PushManager;

      const usePushNotifications = await importComposable();
      const { checkExistingSubscription, checked } = usePushNotifications();

      await checkExistingSubscription();

      expect(checked.value).toBe(false);
    });
  });

  // =========================================================================
  // subscribe
  // =========================================================================
  describe('subscribe', () => {
    it('subscribes successfully, claims the endpoint via RPC, and shows a success toast', async () => {
      const usePushNotifications = await importComposable();
      const { subscribe, subscription } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(true);
      expect(subscription.value).toEqual(mockPushSubscription);
      expect(Notification.requestPermission).toHaveBeenCalled();

      // applicationServerKey is a *decoded* Uint8Array, not the raw base64 string.
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });

      // The claim RPC, not a direct upsert: a browser keeps its endpoint across
      // sign-ins, and an upsert on another user's endpoint fails RLS.
      expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_push_subscription', {
        p_endpoint: 'https://push.example.com/subscription/abc123',
        p_keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
        p_user_agent: navigator.userAgent,
      });
      expect(mockSupabase.from).not.toHaveBeenCalledWith('push_subscriptions');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Notifications Enabled',
        description: 'You will now receive push notifications.',
        color: 'success',
      });
    });

    it('decodes the base64url VAPID key into a non-empty Uint8Array', async () => {
      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();
      await subscribe();

      const arg = mockPushManager.subscribe.mock.calls[0][0].applicationServerKey as Uint8Array;
      expect(arg).toBeInstanceOf(Uint8Array);
      expect(arg.length).toBeGreaterThan(0);
      // It must not be the raw string forwarded.
      expect(typeof arg).not.toBe('string');
    });

    it('returns false and warns when push is not supported', async () => {
      delete (window as any).PushManager;

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Not Supported', color: 'warning' }));
      expect(Notification.requestPermission).not.toHaveBeenCalled();
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });

    it('returns false and warns when user is not authenticated', async () => {
      // Re-stub auth as anonymous for this case.
      cleanupGlobalMocks();
      const setup = setupGlobalMocks({ user: null });
      mockSupabase = setup.mockSupabase as ReturnType<typeof createMockSupabaseClient>;
      vi.stubGlobal('useToast', () => mockToast);
      vi.stubGlobal('useErrorHandler', () => ({ handleError: mockHandleError }));
      setupRuntimeConfig();

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Required', color: 'warning' })
      );
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });

    it('returns false and warns when no VAPID key is configured', async () => {
      stubRuntimeConfig({}); // no vapidPublicKey at all

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Not Configured', color: 'warning' })
      );
      expect(Notification.requestPermission).not.toHaveBeenCalled();
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });

    it('treats an empty-string VAPID key as not configured', async () => {
      stubRuntimeConfig({ vapidPublicKey: '' });

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Not Configured', color: 'warning' })
      );
    });

    it('returns false and warns when permission is denied', async () => {
      (global as any).Notification.requestPermission = vi.fn().mockResolvedValue('denied');

      const usePushNotifications = await importComposable();
      const { subscribe, subscription } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(subscription.value).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Notifications Blocked',
        description: 'Enable notifications in your browser settings to receive push alerts.',
        color: 'warning',
      });
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });

    it('registers the push service worker when this browser has none', async () => {
      navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(undefined);
      (navigator.serviceWorker as any).register = vi.fn().mockResolvedValue(mockRegistration);

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      expect(await subscribe()).toBe(true);
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
      expect(mockPushManager.subscribe).toHaveBeenCalled();
    });

    it('uses an already active registration without waiting on ready', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: new Promise(() => {}),
          getRegistration: vi.fn().mockResolvedValue({ active: {}, pushManager: mockPushManager }),
          register: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const usePushNotifications = await importComposable();
      expect(await usePushNotifications().subscribe()).toBe(true);
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    it('asks for permission before it registers the worker', async () => {
      const order: string[] = [];
      (global as any).Notification.requestPermission = vi.fn(async () => {
        order.push('permission');
        return 'granted';
      });
      navigator.serviceWorker.getRegistration = vi.fn(async () => {
        order.push('registration');
        return mockRegistration;
      });

      const usePushNotifications = await importComposable();
      await usePushNotifications().subscribe();

      expect(order).toEqual(['permission', 'registration']);
    });

    it('does not register a worker when permission is refused', async () => {
      (global as any).Notification.requestPermission.mockResolvedValue('denied');
      (navigator.serviceWorker as any).register = vi.fn();

      const usePushNotifications = await importComposable();
      await usePushNotifications().subscribe();

      expect(navigator.serviceWorker.getRegistration).not.toHaveBeenCalled();
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    it('fails with an error, not a hang, when the worker never activates', async () => {
      vi.useFakeTimers();
      try {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            ready: new Promise(() => {}),
            getRegistration: vi.fn().mockResolvedValue({ active: null, pushManager: mockPushManager }),
            register: vi.fn(),
          },
          writable: true,
          configurable: true,
        });

        const usePushNotifications = await importComposable();
        const pending = usePushNotifications().subscribe();
        await vi.advanceTimersByTimeAsync(10000);

        expect(await pending).toBe(false);
        expect(mockHandleError).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('did not activate') }),
          expect.objectContaining({ toastTitle: 'Failed to enable push notifications' })
        );
        expect(mockPushManager.subscribe).not.toHaveBeenCalled();
        expect(mockSupabase.rpc).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('fails with an error when the worker cannot be registered', async () => {
      navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(undefined);
      (navigator.serviceWorker as any).register = vi.fn().mockRejectedValue(new Error('404'));

      const usePushNotifications = await importComposable();
      expect(await usePushNotifications().subscribe()).toBe(false);
      expect(mockHandleError).toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('records the permission the prompt returned', async () => {
      (global as any).Notification.requestPermission.mockResolvedValue('denied');

      const usePushNotifications = await importComposable();
      const { subscribe, permission } = usePushNotifications();

      await subscribe();

      expect(permission.value).toBe('denied');
    });

    it('returns false silently when permission is dismissed (default)', async () => {
      (global as any).Notification.requestPermission = vi.fn().mockResolvedValue('default');

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      // Dismissed (not denied) shows no toast.
      expect(mockToast.add).not.toHaveBeenCalled();
      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });

    it('handles claim RPC errors via handleError and returns false', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Database error', code: '500' } });

      const usePushNotifications = await importComposable();
      const { subscribe, subscription } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      // Local subscription ref is not committed when the DB write fails.
      expect(subscription.value).toBeNull();
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' }),
        expect.objectContaining({ toastTitle: 'Failed to enable push notifications' })
      );
    });

    it('handles pushManager.subscribe errors via handleError and returns false', async () => {
      mockPushManager.subscribe.mockRejectedValue(new Error('Push subscribe failed'));

      const usePushNotifications = await importComposable();
      const { subscribe } = usePushNotifications();

      const result = await subscribe();

      expect(result).toBe(false);
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ toastTitle: 'Failed to enable push notifications' })
      );
    });
  });

  // =========================================================================
  // unsubscribe
  // =========================================================================
  describe('unsubscribe', () => {
    it('unsubscribes a live subscription and deletes by endpoint', async () => {
      mockSupabase._queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });

      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe, subscription } = usePushNotifications();

      // Establish a live subscription first.
      await subscribe();
      expect(subscription.value).toEqual(mockPushSubscription);

      mockSupabase.from.mockClear();
      mockToast.add.mockClear();

      const result = await unsubscribe();

      expect(result).toBe(true);
      expect(subscription.value).toBeNull();
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('push_subscriptions');
      expect(mockSupabase._queryBuilder.delete).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith(
        'endpoint',
        'https://push.example.com/subscription/abc123'
      );
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications.',
        color: 'info',
      });
    });

    it('returns false when user is not authenticated', async () => {
      cleanupGlobalMocks();
      const setup = setupGlobalMocks({ user: null });
      mockSupabase = setup.mockSupabase as ReturnType<typeof createMockSupabaseClient>;
      vi.stubGlobal('useToast', () => mockToast);
      vi.stubGlobal('useErrorHandler', () => ({ handleError: mockHandleError }));
      setupRuntimeConfig();

      const usePushNotifications = await importComposable();
      const { unsubscribe } = usePushNotifications();

      const result = await unsubscribe();

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it('removes nothing when there is no subscription on this device', async () => {
      const usePushNotifications = await importComposable();
      const { unsubscribe, subscription } = usePushNotifications();

      expect(subscription.value).toBeNull();

      const result = await unsubscribe();

      expect(result).toBe(true);
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
      // Never a delete by user_id: that would turn push off on the user's other devices.
      expect(mockSupabase.from).not.toHaveBeenCalledWith('push_subscriptions');
      expect(mockSupabase._queryBuilder.delete).not.toHaveBeenCalled();
    });

    it('handles push unsubscribe() API errors via handleError and returns false', async () => {
      mockPushSubscription.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe } = usePushNotifications();

      await subscribe();

      const result = await unsubscribe();

      expect(result).toBe(false);
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ toastTitle: 'Failed to disable push notifications' })
      );
    });

    it('deletes the row before unsubscribing the browser', async () => {
      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe } = usePushNotifications();
      await subscribe();
      await unsubscribe();

      expect(mockSupabase._queryBuilder.delete.mock.invocationCallOrder[0]).toBeLessThan(
        mockPushSubscription.unsubscribe.mock.invocationCallOrder[0]
      );
    });

    it('still unsubscribes the browser when the row delete fails, and clears local state', async () => {
      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe, subscription } = usePushNotifications();
      await subscribe();

      mockSupabase._queryBuilder.eq = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Delete failed', code: '500' } });

      const result = await unsubscribe();

      expect(result).toBe(false);
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalled();
      // The endpoint is dead, so delivery has stopped: the UI must not say "enabled".
      expect(subscription.value).toBeNull();
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Delete failed' }),
        expect.objectContaining({ toastTitle: 'Failed to disable push notifications' })
      );
    });

    it('clears local state when the row is gone but the browser unsubscribe fails', async () => {
      mockPushSubscription.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe, subscription } = usePushNotifications();
      await subscribe();

      const result = await unsubscribe();

      expect(result).toBe(false);
      expect(subscription.value).toBeNull();
    });

    it('keeps local state when both the delete and the browser unsubscribe fail', async () => {
      const usePushNotifications = await importComposable();
      const { subscribe, unsubscribe, subscription } = usePushNotifications();
      await subscribe();

      mockSupabase._queryBuilder.eq = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Delete failed', code: '500' } });
      mockPushSubscription.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      const result = await unsubscribe();

      expect(result).toBe(false);
      expect(subscription.value).toEqual(mockPushSubscription);
    });
  });

  // =========================================================================
  // returned interface
  // =========================================================================
  describe('returned interface', () => {
    it('exposes the expected state and methods', async () => {
      const usePushNotifications = await importComposable();
      const result = usePushNotifications();

      expect(result).toHaveProperty('isSupported');
      expect(result).toHaveProperty('subscription');
      expect(result).toHaveProperty('checked');
      expect(result).toHaveProperty('permission');
      expect(typeof result.refreshPermission).toBe('function');
      expect(typeof result.checkExistingSubscription).toBe('function');
      expect(typeof result.subscribe).toBe('function');
      expect(typeof result.unsubscribe).toBe('function');
    });

    it('exposes subscription as a readonly ref (writes are blocked)', async () => {
      const usePushNotifications = await importComposable();
      const { subscription } = usePushNotifications();

      expect(subscription.value).toBeNull();

      // Readonly ref: assignment is a no-op (warns in dev) and must not mutate.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // @ts-expect-error - intentional readonly violation under test
      subscription.value = mockPushSubscription;
      expect(subscription.value).toBeNull();
      warn.mockRestore();
    });
  });
});
