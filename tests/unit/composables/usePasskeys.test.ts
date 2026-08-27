import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The two behaviours worth pinning down here are the ones that are silent when
 * they break:
 *
 *  - A dismissed system prompt must resolve normally, not throw. Supabase
 *    returns cancellation as an `error`, so treating every error as a failure
 *    would show an error toast every time a user changes their mind.
 *  - Registration must survive a failed rename. The passkey is already
 *    registered at that point; reporting a failure would tell the user to try
 *    again and leave them with two.
 */

const mockPasskeyApi = {
  list: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockAuth = {
  passkey: mockPasskeyApi,
  registerPasskey: vi.fn(),
  signInWithPasskey: vi.fn(),
};

const mockSupabase = { auth: mockAuth };

const PASSKEY = { id: 'pk-1', friendly_name: 'Mac', created_at: '2026-08-01T00:00:00Z' };

const cancelError = Object.assign(new Error('The operation either timed out or was not allowed.'), {
  name: 'NotAllowedError',
});

beforeEach(() => {
  vi.resetModules();
  mockPasskeyApi.list.mockResolvedValue({ data: [PASSKEY], error: null });
  mockPasskeyApi.update.mockResolvedValue({ data: PASSKEY, error: null });
  mockPasskeyApi.delete.mockResolvedValue({ data: null, error: null });
  mockAuth.registerPasskey.mockResolvedValue({ data: PASSKEY, error: null });
  mockAuth.signInWithPasskey.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useAnalytics', () => ({ track: vi.fn() }));
  // isSupported() reads import.meta.client, which is true under the test env.
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {} as unknown as typeof globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  (global as any).__resetNuxtState();
});

const load = async () => (await import('~/app/composables/usePasskeys')).usePasskeys;

describe('usePasskeys', () => {
  describe('isCancelled()', () => {
    it('treats NotAllowedError as a cancellation', async () => {
      const { isCancelled } = (await load())();
      expect(isCancelled(cancelError)).toBe(true);
    });

    it('treats AbortError as a cancellation', async () => {
      const { isCancelled } = (await load())();
      expect(isCancelled(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    });

    it('does not treat a server error as a cancellation', async () => {
      const { isCancelled } = (await load())();
      expect(isCancelled(new Error('Passkey challenge expired'))).toBe(false);
    });
  });

  describe('listPasskeys()', () => {
    it('populates shared state from the API', async () => {
      const { listPasskeys, passkeys } = (await load())();
      await listPasskeys();
      expect(passkeys.value).toEqual([PASSKEY]);
    });

    it('throws on an API error so the caller can surface it', async () => {
      mockPasskeyApi.list.mockResolvedValue({ data: null, error: new Error('nope') });
      const { listPasskeys, loading } = (await load())();
      await expect(listPasskeys()).rejects.toThrow('nope');
      // The spinner must clear even on the failure path.
      expect(loading.value).toBe(false);
    });
  });

  describe('registerPasskey()', () => {
    it('names the new passkey in a follow-up call', async () => {
      const { registerPasskey } = (await load())();
      await registerPasskey('Work laptop');
      expect(mockPasskeyApi.update).toHaveBeenCalledWith({ passkeyId: 'pk-1', friendlyName: 'Work laptop' });
    });

    it('still reports success when only the rename fails', async () => {
      mockPasskeyApi.update.mockRejectedValue(new Error('rename blew up'));
      const { registerPasskey } = (await load())();
      await expect(registerPasskey('Work laptop')).resolves.toBeTruthy();
    });

    it('resolves to null when the user dismisses the prompt', async () => {
      mockAuth.registerPasskey.mockResolvedValue({ data: null, error: cancelError });
      const { registerPasskey } = (await load())();
      await expect(registerPasskey()).resolves.toBeNull();
    });

    it('throws on a genuine registration failure', async () => {
      mockAuth.registerPasskey.mockResolvedValue({ data: null, error: new Error('challenge expired') });
      const { registerPasskey } = (await load())();
      await expect(registerPasskey()).rejects.toThrow('challenge expired');
    });
  });

  describe('renamePasskey()', () => {
    it('truncates a name to the 120 character server limit', async () => {
      const { renamePasskey } = (await load())();
      await renamePasskey('pk-1', 'x'.repeat(200));
      expect(mockPasskeyApi.update).toHaveBeenCalledWith({ passkeyId: 'pk-1', friendlyName: 'x'.repeat(120) });
    });
  });

  describe('deletePasskey()', () => {
    it('refreshes the list after a delete', async () => {
      const { deletePasskey } = (await load())();
      await deletePasskey('pk-1');
      expect(mockPasskeyApi.delete).toHaveBeenCalledWith({ passkeyId: 'pk-1' });
      expect(mockPasskeyApi.list).toHaveBeenCalled();
    });

    it('throws on an API error', async () => {
      mockPasskeyApi.delete.mockResolvedValue({ data: null, error: new Error('denied') });
      const { deletePasskey } = (await load())();
      await expect(deletePasskey('pk-1')).rejects.toThrow('denied');
    });
  });

  describe('signInWithPasskey()', () => {
    it('forwards the captcha token — the options endpoint rejects a request without one', async () => {
      const { signInWithPasskey } = (await load())();
      await signInWithPasskey('turnstile-token');
      expect(mockAuth.signInWithPasskey).toHaveBeenCalledWith({ options: { captchaToken: 'turnstile-token' } });
    });

    it('resolves true once a session comes back', async () => {
      const { signInWithPasskey } = (await load())();
      await expect(signInWithPasskey('t')).resolves.toBe(true);
    });

    it('resolves false when the user dismisses the prompt', async () => {
      mockAuth.signInWithPasskey.mockResolvedValue({ data: null, error: cancelError });
      const { signInWithPasskey } = (await load())();
      await expect(signInWithPasskey('t')).resolves.toBe(false);
    });

    it('throws on a genuine sign-in failure', async () => {
      mockAuth.signInWithPasskey.mockResolvedValue({ data: null, error: new Error('captcha protection') });
      const { signInWithPasskey } = (await load())();
      await expect(signInWithPasskey('t')).rejects.toThrow('captcha protection');
    });
  });
});
